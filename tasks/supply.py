# encoding: utf-8
import json
import logging

from sqlalchemy import and_
from sqlalchemy.orm import sessionmaker
import tornado.ioloop
import tornado.gen
from tornado.httpclient import AsyncHTTPClient

from db.machado import get_card_shard
from datetime import datetime as dt

request_log = logging.getLogger("machado.request")


class SupplyTask(tornado.ioloop.PeriodicCallback):
    ON_RUNNING = False

    def __init__(self, application, callback_time):
        super(SupplyTask, self).__init__(self.supply, callback_time)
        self.application = application
        self.master = self.application.sentinel.master_for('machado')
        self.slave = self.application.sentinel.slave_for('machado')

    @tornado.gen.coroutine
    def supply(self):
        if self.ON_RUNNING:
            return
        try:
            self.ON_RUNNING = True

            if not self.check_flag():
                return

            sites = self.application.config['sites']
            for site in sites:
                yield self.supply_site(site)

        finally:
            self.ON_RUNNING = False

    @tornado.gen.coroutine
    def supply_site(self, site):
        try:
            yield self.recv_used_card(site)  # 获取所有用过的卡
            pool_name_list = yield self.sync_card_pool_config(site)  # 推送卡池配置信息

            inquiry_info = yield self.sync_card_pool_status(site, pool_name_list)  # 本地和远端卡池状态
            yield self.supply_card(site, pool_name_list, inquiry_info)  # 根据远端卡池状态推送卡

        except:
            request_log.exception('SUPPLY_SITE EXCEPTION')

    # 卡池维护检测
    def check_flag(self):
        try:
            # redis
            self.master = self.application.sentinel.master_for('machado')

            if self.master.exists('flag:task'):
                request_log.info('STOP FLAG FOUND!')
                return False
        except Exception as e:
            request_log.exception('GET REDIS FAIL')
            return False
        return True

    # 推送卡池配置信息(公共使用卡池,用户卡池配置,卡池列表)
    @tornado.gen.coroutine
    def sync_card_pool_config(self, site):
        local_site_name = self.application.config['config']['name']

        card_type = site['card_type']

        # 公共使用卡池
        pool_list_config_key = 'map:card_pool_list:{0}:config'.format(card_type)
        pub_use_pool = self.slave.hget(pool_list_config_key, 'pub_use_pool')

        # 卡池名称列表
        pool_name_list = []
        pool_key_list = self.slave.keys('map:card_pool_info:{0}:*'.format(card_type))
        for pool_key in pool_key_list:
            pool_name = pool_key.split(':')[-1]
            pool_name_list.append(pool_name)

        # 用户配置列表
        user_list = []
        downstream_user_key_list = self.slave.keys('map:downstream_user:{0}:*'.format(card_type))
        for downstream_user_key in downstream_user_key_list:
            downstream_user_id = downstream_user_key.split(':')[-1]
            user_config = {}

            user_info = self.slave.hgetall(downstream_user_key)
            user_config['user_id'] = downstream_user_id
            user_config['card_pool_list'] = []

            for seq in eval(user_info['card_pool_seq_list']):
                card_pool = user_info[seq]
                if card_pool != '':
                    user_config['card_pool_list'].append(card_pool)

            user_list.append(user_config)
        user_list = sorted(user_list, key=lambda u: u['user_id'])

        url = site['url'] + '/card/card_pool_config'

        card_pool_config = {
            'site': local_site_name,
            'pub_use_pool': pub_use_pool,
            'pool_name_list': pool_name_list,
            'user_list': user_list,
        }

        # 发送数据
        requ_data = json.dumps(card_pool_config)
        try:
            http_client = AsyncHTTPClient()
            resp = yield http_client.fetch(url, method='POST', body=requ_data, request_timeout=120)
            request_log.info('SYNC_CARD_POOL_CONFIG [site {0}] RESP {1}'.format(local_site_name, resp.body.decode()))
        except:
            request_log.exception('CONFIG POOL FAIL')

        return pool_name_list

    # 推送本地卡池状态信息，并获取远端卡池状态信息
    @tornado.gen.coroutine
    def sync_card_pool_status(self, site, card_pool_list):
        local_site_name = self.application.config['config']['name']

        url = site['url'] + '/card/inquiry'
        card_type = site['card_type']

        pool_map = {}

        for card_pool in card_pool_list:
            # 计算本地的库存信息
            inventory_info = {}
            for price in site['price']:
                card_list_key = 'list:card:{0}:{1}:{2}'.format(card_type, card_pool, price)
                inventory_info[price] = self.slave.llen(card_list_key)

            pool_map[card_pool] = inventory_info

        # 发送数据
        requ_data = json.dumps({
            'site': local_site_name,
            'pool_list': pool_map
        })

        request_log.info('SYNC_CARD_POOL_STATUS REQU {0}'.format(requ_data))

        try:
            http_client = AsyncHTTPClient()
            resp = yield http_client.fetch(url, method='POST', body=requ_data, request_timeout=120)
            resp_data = resp.body.decode()
            inquiry_info = json.loads(resp_data)
            request_log.info('SYNC_CARD_POOL_STATUS RESP {0}'.format(inquiry_info))

        except:
            request_log.exception('SYNC_CARD_POOL_STATUS FAIL')

            inquiry_info = None

        # 得到远端的库存数据
        return inquiry_info

    # 根据远端的库存信息提供新卡给远端
    @tornado.gen.coroutine
    def supply_card(self, site, card_pool_list, all_inquiry_info):
        card_type = site['card_type']
        local_site_name = self.application.config['config']['name']

        card_list = []

        for card_pool in all_inquiry_info:
            inquiry_info = all_inquiry_info[card_pool]

            request_log.info('SUPPY POOL %s %s', card_pool, inquiry_info)
            pool_info_key = 'map:card_pool_info:{0}:{1}'.format(card_type, card_pool)
            need_cache = self.master.hget(pool_info_key, 'need_cache')
            if need_cache == '0':
                continue

            reserved = site['reserved']
            max_count = site['max']

            # 根据远端库存信息取卡
            for price in site['price']:
                current = int(inquiry_info.get(price, 0))

                # 远端卡池的卡数量充足
                if current >= reserved:
                    continue

                count = min(reserved - current, max_count)
                # getting new cards
                for i in range(0, count):
                    card_id = self.master.rpop('list:card:{0}:{1}:{2}'.format(card_type, card_pool, price))

                    if card_id is None:
                        continue

                    password = self.master.hget('card:%s' % card_id, 'password')
                    box_id = self.master.hget('card:%s' % card_id, 'box')
                    user_id = self.master.hget('box:%s' % box_id, 'user_id')
                    package_no = self.master.hget('card:%s' % card_id, 'package')
                    create_time = self.master.hget('card:%s' % card_id, 'create_time')
                    file_name = self.master.hget('card:%s' % card_id, 'file_name')

                    if password:
                        card_list.append({
                            'id': card_id,
                            'price': price,
                            'password': password,
                            'box': box_id,
                            'user_id': user_id,
                            'package': package_no,
                            'create_time': create_time,
                            'file_name': file_name,
                            'card_pool': card_pool
                        })

        # 发送数据
        if len(card_list) <= 0:
            return

        url = site['url'] + '/card/supply'
        requ_data = json.dumps({
            'site': local_site_name,
            # 'card_pool': card_pool,
            'card_list': card_list,
        })

        try:
            request_log.info('SUPPLY_CARD  REQU {0}'.format(requ_data))
            http_client = AsyncHTTPClient()
            resp = yield http_client.fetch(url, method='POST', body=requ_data)
            request_log.info('SUPPLY_CARD  RESP {0}'.format(resp.body.decode()))

            card_id_list = []
            for card_info in card_list:
                card_id_list.append(card_info['id'])

            self.update_card_status('inuse', card_id_list)
        except:
            request_log.exception("SUPPLY_CARD EXCEPTION")

    # 接收远端用过的卡
    @tornado.gen.coroutine
    def recv_used_card(self, site):
        local_site_name = self.application.config['config']['name']

        # 发送数据
        url = site['url'] + '/card/used'
        requ_data = json.dumps({
            'site': local_site_name,
        })

        try:
            request_log.info("-")
            http_client = AsyncHTTPClient()
            response = yield http_client.fetch(url, method='POST', body=requ_data, request_timeout=120)
            body = response.body.decode()
            request_log.info("RECV_USED_CARD RESP [SITE {0}] {1}".format(local_site_name, body))
            resp_data = json.loads(body)

        except:
            request_log.exception("RECV_USED_CARD EXCEPTION")
            return

        # 修改本地卡列表状态
        self.update_card_status('error', resp_data['error'])
        self.update_card_status('used', resp_data['used'])
        self.update_rollback_card(resp_data['rollback'])

    # 修改卡在数据库中的状态
    def update_card_status(self, status, card_list):
        if len(card_list) <= 0:
            return

        request_log.info("UPDATE_CARD_STATUS {0} {1}".format(status, card_list))

        session = None
        try:
            # 更新redis中的卡状态
            for card in card_list:
                if status == 'used':
                    card_id = card['id']
                else:
                    card_id = card
                request_log.info('CACHE CARD {0} {1}'.format(status, card_id))

                self.master.hset('card:{0}'.format(card_id), 'state', status)
                box_id = self.master.hget('card:{0}'.format(card_id), 'box')
                self.master.hincrby('box:{0}'.format(box_id), status, 1)

                if status == 'inuse':
                    self.master.hincrby('box:{0}'.format(box_id), 'ready', -1)
                elif status in ['used', 'error']:
                    self.master.hincrby('box:{0}'.format(box_id), 'inuse', -1)

            # 更新数据库中卡的状态
            engine = self.application.engine['machado']
            session = sessionmaker(bind=engine)()
            for card_obj in card_list:
                if status == 'used':
                    card_id = card_obj['id']
                else:
                    card_id = card_obj

                card_info = self.master.hmget('card:{0}'.format(card_id), ['part', 'site', 'state', 'box'])
                part = card_info[0]
                box_id = int(card_info[3])
                if part is None:
                    continue

                card_part = get_card_shard(part)
                card = session.query(card_part).filter(card_part.card_id == card_id).filter(
                        card_part.box_id == box_id).first()

                if card is None:
                    continue

                card.site = card_info[1]
                card.status = card_info[2]
                card.update_time = dt.now()
                if status == 'used':
                    card.order_id = card_obj.get('order_id')
                    card.target_user = card_obj.get('user_id')

                session.add(card)

            session.commit()

            # 删掉用过的卡
            if status == 'used':
                for card_id in card_list:
                    request_log.info('CLEAN CACHE {0}'.format(card_id))
                    self.master.delete('card:{0}'.format(card_id))
        except Exception as e:
            request_log.exception('UPDATE_CARD_STATUS EXCEPTION')

        finally:
            if session: session.close()

    # 处理回滚的卡
    def update_rollback_card(self, card_list):
        for card_id in card_list:
            request_log.error('ROLLBACK CARD[{0}]'.format(card_id))

            box_id, price,status = self.master.hmget('card:%s' % card_id, 'box', 'price', 'status')
            box_key = 'box:{0}'.format(box_id)
            redis_box_info  = self.master.hgetall(box_key)
            if not redis_box_info:
                request_log.error('ROLLBACK CARD[{0}] ERROR!!!'.format(card_id))
                self.master.sadd('set:card:rollback:unknown', card_id)
                continue

            #修改卡盒里面的计数信息
            self.master.hincrby('box:{0}'.format(box_id), 'inuse', -1)
            self.master.hincrby('box:{0}'.format(box_id), 'ready', 1)

            # 根据冻结状态设置数据
            if redis_box_info.get('status') != 'frozen':
                card_list_key = 'list:card:{0}:{1}:{2}'.format(redis_box_info['card_type'], redis_box_info['pool'], redis_box_info['price'])
                self.master.rpush(card_list_key, card_id)
            else:
                engine = self.application.engine['machado']
                db_session = sessionmaker(bind=engine)()
                card_part = get_card_shard(redis_box_info['part'])
                try:
                    db_session.query(card_part).filter( and_(card_part.card_id == card_id, card_part.box_id == box_id) ).update({'status': 'frozen'})
                    db_session.commit()
                except:
                    request_log.exception('ROLLBACK CARD[{0}] EXCEPTION!!!'.format(card_id))
                finally:
                    db_session.close()

