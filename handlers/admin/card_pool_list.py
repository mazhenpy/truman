# coding=utf8
import json
import time
from handlers import JsonHandler
import logging
from db.machado import Box, get_card_shard
from _datetime import datetime
import tornado
from sqlalchemy.orm.session import sessionmaker

log_request = logging.getLogger("machado.request")


# 目前用到的redis容器有
# map:card_pool_list:{card_type}:config  #整个卡池列表的配置信息
# map:card_pool_info:{card_type}:{pool_name}  #单个卡池的基本信息
# set:card_pool:box_list:{card_type}:{pool_name}   #单个卡池的盒号集合信息
# box:{box_id}     #单盒卡的基本信息
class AdminCardPoolListHandler(JsonHandler):
    @tornado.web.authenticated
    def get(self):
        if 'card_import' not in self.current_user['roles'] and 'card_maintain_beta' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        log_request.info("CARD_POOL GET REQU: {0}".format(self.request.uri))

        self.card_type = self.get_argument('card_type')
        self.requ_type = self.get_argument('requ_type', None)

        if self.requ_type != 'get_pool_list' and 'card_maintain_beta' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        if self.requ_type == 'get_pool_list':
            return self.get_pool_list()
        elif self.requ_type == 'get_box_list':
            return self.get_box_list()
        elif self.requ_type == 'get_pool_list_config':
            return self.get_pool_list_config()
        elif self.requ_type == 'get_pool_history':
            return self.get_pool_history()
        elif self.requ_type == 'get_user_list':
            return self.get_user_list()
        else:
            return self.render('admin_card_pool_list.html', card_type=self.card_type)

    @tornado.web.authenticated
    def post(self):
        if 'card_maintain_beta' not in self.current_user['roles']:
            return self.finish()

        log_request.info("CARD_POOL POST REQU: {0}".format(self.json_args))
        self.card_type = self.get_argument('card_type')
        self.requ_type = self.json_args['requ_type']
        self.argu_list = self.json_args.get('argu_list', '')

        if self.requ_type == 'add_pool':
            return self.add_pool()
        elif self.requ_type == 'remove_pool':
            return self.remove_pool()
        elif self.requ_type == 'set_pool_list_config':
            return self.set_pool_list_config()
        elif self.requ_type == 'move_box_list':
            return self.move_box_list()
        elif self.requ_type == 'add_user':
            return self.add_user()
        elif self.requ_type == 'remove_user':
            return self.remove_user()
        elif self.requ_type == 'set_user_card_pool':
            return self.set_user_card_pool()
        elif self.requ_type == 'set_pool_config':
            return self.set_pool_config()

        return self.resp_result('fail', '未知请求')

    def resp_result(self, status, msg, data=None):
        resp_data = {'status': status, 'msg': msg, 'data': data}
        log_request.info("CARD_POOL RESP: {0}".format(resp_data))

        resp_data = json.dumps(resp_data)
        return self.finish(resp_data)

    @property
    def pool_list_config(self):
        pool_list_config_key = 'map:card_pool_list:{0}:config'.format(self.card_type)
        return self.slave.hgetall(pool_list_config_key)

    def get_pool_list(self):
        def_up_pool = self.pool_list_config.get('def_up_pool')

        if 'admin' in self.current_user['roles']:
            pool_key_list = self.slave.keys('map:card_pool_info:{0}:*'.format(self.card_type))
            if def_up_pool != None:
                def_up_pool_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, def_up_pool)
                pool_key_list.remove(def_up_pool_key)
                pool_key_list.insert(0, def_up_pool_key)
        else:
            user_id = self.current_user['user_id']
            pool_key_list = self.slave.hmget('map:downstream_user:%s:%s' % (self.card_type, user_id), [
                'card_pool_seq1', 'card_pool_seq2', 'card_pool_seq3', 'card_pool_seq4', 'card_pool_seq5'
            ])
            pool_key_list = [x for x in pool_key_list if x != None and x != '']

        def_up_pool_info = None
        pool_list = []
        for pool_key in pool_key_list:
            pool_name = pool_key.split(':')[-1]

            pool_info_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, pool_name)
            pool_info = self.slave.hgetall(pool_info_key)
            # if pool_name == def_up_pool:
            #     def_up_pool_info = pool_info
            # else:
            pool_list.append(pool_info)

        # pool_list = sorted(pool_list, key=lambda p: p['create_tsp'])
        # if def_up_pool_info:
        #     pool_list.insert(0, def_up_pool_info)

        return self.resp_result('ok', '成功', {'pool_list': pool_list})

    def get_box_list(self):
        pool_name = self.get_argument('pool_name')

        box_id_list_key = 'set:card_pool:box_list:{0}:{1}'.format(self.card_type, pool_name)
        box_id_list = self.slave.smembers(box_id_list_key)

        box_list = []
        session = self.session('machado')
        for box_id in box_id_list:
            box_info_key = 'box:{0}'.format(box_id)
            box_info = self.master.hgetall(box_info_key)
            box_info['box_id'] = box_id

            db_box_info = session.query(Box).filter(Box.id == box_id).one()
            box_info['filename'] = str(db_box_info.filename)
            box_info['package'] = str(db_box_info.package)
            box_info['create_time'] = str(db_box_info.create_time)

            box_list.append(box_info)

        box_list = sorted(box_list, key=lambda b: b['create_time'], reverse=True)
        return self.resp_result('ok', '成功', {'box_list': box_list})

    def get_pool_list_config(self):
        return self.resp_result('ok', '成功', self.pool_list_config)

    def get_pool_history(self):
        pool_name = self.get_argument('pool_name')
        history_list_key = 'list:history:{0}:{1}'.format(self.card_type, pool_name)

        history_list = []
        i = 0
        while i < 10:
            h = self.slave.lindex(history_list_key, i)
            if h:
                history_list.append(h)
            else:
                break
            i += 1

        return self.resp_result('ok', '成功', {'history_list': history_list[::-1]})

    def value_info(self, box_list):
        total_value = 0
        price_value_info = {}
        for box_id in box_list:
            box = box_list[box_id]
            price = int(box['price'])

            if not price_value_info.get(price):
                price_value_info[price] = 0

            v = int(box['price']) * int(box['ready'])

            price_value_info[price] += v
            total_value += v

        total_value /= 10000
        value_info_str = '总面值({0}万)'.format(total_value)
        for price in price_value_info:
            value_info_str += " {0}({1}万)".format(price, price_value_info[price] / 10000)

        return value_info_str


    @tornado.gen.coroutine
    def move_box_list(self):
        source_pool = self.argu_list['source_pool']
        dest_pool = self.argu_list['dest_pool']
        move_box_list = self.argu_list['move_box_list']

        # 检查所有的盒号是否存在指定的set中
        source_box_id_list_key = 'set:card_pool:box_list:{0}:{1}'.format(self.card_type, source_pool)
        for box_id in move_box_list:
            if not self.slave.sismember(source_box_id_list_key, box_id):
                log_request.error('CHECK BOX {0} FAIL,NOT IN POOL {1}'.format(box_id, source_pool))
                return self.resp_result('fail', '盒号{0}检查失败!!!'.format(box_id))

        # 移卡
        engine = self.application.engine['machado']
        session = sessionmaker(bind=engine)()

        move_box_info_list = {}
        try:
            dest_box_id_list_key = 'set:card_pool:box_list:{0}:{1}'.format(self.card_type, dest_pool)
            for box_id in move_box_list:
                box = self.slave.hgetall('box:{0}'.format(box_id))
                move_box_info_list[box_id] = box

                # 移动每张卡
                card_part = get_card_shard(box['part'])
                query = session.query(card_part).filter(card_part.box_id == box_id, card_part.status == 'ready').all()

                source_card_list_key = 'list:card:{0}:{1}:{2}'.format(box['card_type'], source_pool, box['price'])
                dest_card_list_key = 'list:card:{0}:{1}:{2}'.format(box['card_type'], dest_pool, box['price'])
                for card in query:
                    result = self.master.lrem(source_card_list_key, 0, card.card_id)
                    if not result:
                        log_request.error(
                            'move box card error lrem card_id:{0} result:{1}'.format(card.card_id, result))
                    else:
                        result = self.master.lpush(dest_card_list_key, card.card_id)
                        log_request.debug('move box card lrem card_id:{0} result:{1}'.format(card.card_id, result))

                yield tornado.gen.moment


                # 移动单盒卡
                self.master.hset('box:{0}'.format(box_id), 'pool', dest_pool)

                if self.master.srem(source_box_id_list_key, box_id) == 1:
                    log_request.info('REMOVE BOX {0} FROM {1}'.format(box_id, source_pool))
                else:
                    log_request.warn('REMOVE BOX {0} FROM {1} ERROR!!!!!!!!!!!!'.format(box_id, source_pool))

                if self.master.sadd(dest_box_id_list_key, box_id) == 1:
                    log_request.info('ADD BOX {0} TO {1}'.format(box_id, dest_pool))
                else:
                    log_request.warn('ADD BOX {0} TO {1} ERROR!!!!!!!!!!!!'.format(box_id, dest_pool))
        except:
            log_request.exception("MOVE CARD_POOL {0} BOXES TO {1} EXCEPTION".format(source_pool, dest_pool))


        # 记录操作历史
        value_info = self.value_info(move_box_info_list)
        log_request.info('CARD_POOL HISTORY {0}'.format(value_info))
        source_history_list_key = 'list:history:{0}:{1}'.format(self.card_type, source_pool)
        self.master.lpush(source_history_list_key,
                          "{0} 移出到 >>{1}<< {2} ".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), dest_pool,
                                                        value_info))

        dest_history_list_key = 'list:history:{0}:{1}'.format(self.card_type, dest_pool)
        self.master.lpush(dest_history_list_key,
                          "{0} 接收自 >>{1}<< {2}".format(datetime.now().strftime("%Y-%m-%d %H:%M:%S"), source_pool,
                                                       value_info))

        return self.resp_result('ok', '成功')

    def add_pool(self):
        new_pool_info = self.argu_list['new_pool_info']
        pool_name = new_pool_info['pool_name']
        pool_name = pool_name.strip()

        # 检测参数是否合法
        if self.slave.exists('map:card_pool_info:{0}:{1}'.format(self.card_type, pool_name)):
            return self.resp_result('fail', '卡池名称已存在')

        # 新建一个卡池
        new_pool_info_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, pool_name)
        self.master.hmset(new_pool_info_key, {
            'pool_name': pool_name,
            'need_cache': 0,
            'create_tsp': int(time.time())
        })

        return self.resp_result('ok', '成功')

    def set_pool_config(self):
        card_pool = self.argu_list['card_pool']
        key = self.argu_list['key']
        value = self.argu_list['value']

        pool_info_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, card_pool)
        if not self.slave.exists(pool_info_key):
            return self.resp_result('fail', '卡池信息不存在')

        if key == 'need_cache' and value == False and self.pool_list_config['pub_use_pool'] == card_pool:
            return self.resp_result('fail', '公共卡池必须预留')

        self.master.hset(pool_info_key, key, value)
        return self.resp_result('ok', '成功')

    def remove_pool(self):
        def_up_pool = self.pool_list_config.get('def_up_pool')
        pub_use_pool = self.pool_list_config.get('pub_use_pool')

        new_pool_info = self.argu_list['pool_info']
        pool_name = new_pool_info['pool_name']


        # 判断是否是默认上卡卡池或者是公共使用卡池
        if pool_name == def_up_pool:
            return self.resp_result('fail', '不能删除默认上卡卡池')

        if pool_name == pub_use_pool:
            return self.resp_result('fail', '不能删除默认上卡卡池')

        # 判断该卡池是否为空
        box_id_list_key = 'set:card_pool:box_list:{0}:{1}'.format(self.card_type, pool_name)
        if self.slave.scard(box_id_list_key) != 0:
            return self.resp_result('fail', '不能删除非空卡池 盒号不为空')

        if len(self.slave.keys('list:card:{0}:{1}:*'.format(self.card_type, pool_name))) != 0:
            return self.resp_result('fail', '不能删除非空卡池 卡不为空')

        # 判断该卡池是否正在被其他用户使用
        user_list = self.driver_get_user_list()
        for user_info in user_list:
            card_pool_seq_list = user_info['card_pool_seq_list']
            for card_pool_seq in card_pool_seq_list:
                if user_info[card_pool_seq] == pool_name:
                    return self.resp_result('fail', '不能删除用户正在使用中的卡池')

        # 判断卡池信息是否存在
        pool_info_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, pool_name)
        if self.slave.exists(pool_info_key):
            self.master.delete(pool_info_key)
        else:
            return self.resp_result('fail', '找不到该卡池的信息')

        return self.resp_result('ok', '成功')

    def set_pool_list_config(self):
        pool_list_config_key = 'map:card_pool_list:{0}:config'.format(self.card_type)
        self.master.hmset(pool_list_config_key, self.argu_list)

        pub_use_pool = self.pool_list_config.get('pub_use_pool')
        if pub_use_pool:
            pub_pool_info_key = 'map:card_pool_info:{0}:{1}'.format(self.card_type, pub_use_pool)
            self.master.hset(pub_pool_info_key, 'need_cache', 1)
        return self.resp_result('ok', '成功')

    def driver_get_user_list(self):
        downstream_user_key_list = self.slave.keys('map:downstream_user:{0}:*'.format(self.card_type))

        user_list = []
        for downstream_user_key in downstream_user_key_list:
            downstream_user_id = downstream_user_key.split(':')[-1]
            user_info = self.slave.hgetall(downstream_user_key)

            user_info['user_id'] = downstream_user_id
            user_info['card_pool_seq_list'] = eval(user_info['card_pool_seq_list'])

            user_list.append(user_info)

        user_list = sorted(user_list, key=lambda u: u['user_id'])
        return user_list

    def get_user_list(self):
        return self.resp_result('ok', '成功', {'user_list': self.driver_get_user_list()})

    def add_user(self):
        new_user_info = self.argu_list['new_user_info']
        new_user_info['user_id'] = new_user_info['user_id'].strip()
        new_user_info['user_name'] = new_user_info['user_name'].strip()

        # 用户ID必须是数字
        if not new_user_info['user_id'].isdigit():
            return self.resp_result('fail', '用户ID必须是纯数字')

        user_info_key = 'map:downstream_user:{0}:{1}'.format(self.card_type, new_user_info['user_id'])
        # 判断用户ID是否存在
        if self.slave.exists(user_info_key):
            return self.resp_result('fail', '用户ID已存在')

        self.master.hmset(user_info_key, {
            'user_id': new_user_info['user_id'],
            'user_name': new_user_info['user_name'],
            'card_pool_seq_list': ['card_pool_seq1', 'card_pool_seq2', 'card_pool_seq3', 'card_pool_seq4',
                                   'card_pool_seq5'],
            'card_pool_seq1': '',
            'card_pool_seq2': '',
            'card_pool_seq3': '',
            'card_pool_seq4': '',
            'card_pool_seq5': '',
        })

        return self.resp_result('ok', '成功')

    def remove_user(self):
        user_info = self.argu_list['user_info']

        user_info_key = 'map:downstream_user:{0}:{1}'.format(self.card_type, user_info['user_id'])

        # 判断用户ID是否存在
        if not self.slave.exists(user_info_key):
            return self.resp_result('fail', '该用户不存在')

        self.master.delete(user_info_key)

        return self.resp_result('ok', '成功')

    def set_user_card_pool(self):
        user_info = self.argu_list['user_info']
        card_pool_seq = self.argu_list['card_pool_seq']
        card_pool_name = self.argu_list['card_pool_name']

        # 检查用户状态是否合法
        user_info_key = 'map:downstream_user:{0}:{1}'.format(self.card_type, user_info['user_id'])
        user_info = self.slave.hgetall(user_info_key)
        if not user_info:
            return self.resp_result('fail', '找不到相关用户')

        # 检查卡池状态是否合法
        if card_pool_name != '' and not self.slave.exists(
                'map:card_pool_info:{0}:{1}'.format(self.card_type, card_pool_name)):
            return self.resp_result('fail', '找不到对应的卡池')

        user_info[card_pool_seq] = card_pool_name
        card_pool_seq_list = eval(user_info['card_pool_seq_list'])
        for index in card_pool_seq_list:
            if user_info[index] == card_pool_name:
                self.master.hset(user_info_key, index, '')

        self.master.hset(user_info_key, card_pool_seq, card_pool_name)

        return self.resp_result('ok', '成功')
