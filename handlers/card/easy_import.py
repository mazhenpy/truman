import hashlib
import re
import datetime as dt
import json
import logging
from sqlalchemy.orm import sessionmaker
from tornado.httpclient import AsyncHTTPClient
import tornado.web
import tornado.gen
import tornado.ioloop
import onetimepass as otp

from utils import aes_encrypt
from db.machado import Box, get_card_shard
from handlers import JsonHandler

log_request = logging.getLogger("machado.request")

sinopec_pattern_card = re.compile('^\d{16}$')
sinopec_pattern_pass = re.compile('^\d{20}$')

COMMIT_LIMIT = 100


def to_percent(str):
    if not str:
        return None
    return int(float(str) * 100)


def signature(part):
    m = hashlib.md5()
    m.update(part.encode('utf8'))
    return m.hexdigest().upper()


class ApiEasyImportHandler(JsonHandler):
    @tornado.gen.coroutine
    def post_fund(self, fund_type, order_id, user_id, income, notes=''):
        status = 'unknown'

        try:
            config = self.application.config.get('fund')
            secret = config.get('secret')
            operator = config.get('operator')
            url = config.get('url')

            token = otp.get_totp(secret)

            sign0 = signature('{user_id}{order_id}{income}{operator}{token}'.format(
                user_id=user_id,
                order_id=order_id,
                income=income,
                operator=operator,
                token=token))

            body = json.dumps({'type': fund_type,
                               'order_id': order_id,
                               'user_id': user_id,
                               'income': income,
                               'operator': operator,
                               'token': token,
                               'notes': notes,
                               'sign': sign0})

            http_client = AsyncHTTPClient()

            log_request.info("FUND_URL http://%s/admin/fund", url)
            log_request.info("FUND_BODY %s", body)

            response = yield http_client.fetch(url, method='POST', body=body,
                                               headers={'Content-Type': 'application/json'}, request_timeout=120)

            if response.code == 200:
                msg = json.loads(response.body.decode())
                status = msg.get('status')

        except:
            log_request.exception("ERROR ADD FUND")
            status = 'unknown'

        return status

    @tornado.web.authenticated
    def get(self, path):
        if 'card_import' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        if path == 'list':
            self.get_list()
        else:
            self.send_error(500)

    def get_list(self):
        user_id = self.current_user['user_id']

        card_list = []
        card_lines = self.master.lrange('list:easy:card:' + user_id, 0, -1)
        for card in card_lines:
            card_id, price, password = card.split(';')
            card_list.append({'price': price, 'id': card_id, 'password': password})

        self.finish(json.dumps(card_list))

    @tornado.web.authenticated
    @tornado.gen.coroutine
    def post(self, path):
        if 'card_import' not in self.current_user['roles']:
            return self.finish()

        if path == 'add':
            self.post_add()
        elif path == 'remove':
            self.post_remove()
        elif path == 'reset':
            self.post_reset()
        elif path == 'commit':
            yield self.post_commit()
        else:
            self.send_error(404)

    def post_add(self):

        master = self.master

        try:
            user_id = self.current_user['user_id']
            card_id = self.json_args.get('id')
            password = self.json_args.get('password')
            price = self.json_args.get('price')

            if master.llen('list:easy:card:' + user_id) > COMMIT_LIMIT:
                raise RuntimeError('您本次扫描已超过上限(%d)，请先提交' % COMMIT_LIMIT)

            if master.sismember('set:easy:card:' + user_id, card_id):
                raise RuntimeError('您提交的卡号已经扫描过了，请核实！')

            number_check = self.application.number_check
            if not number_check.is_loaded():
                raise RuntimeError('系统维护中，请稍后再试')

            if number_check.exists(card_id):
                raise RuntimeError('您提交的卡号在系统中已经存在了，请核实！')

            key = '%s;%s;%s' % (card_id, price, password)
            master.lpush('list:easy:card:' + user_id, key)
            master.sadd('set:easy:card:' + user_id, card_id)

            self.finish(json.dumps({'status': 'ok'}))

        except RuntimeError as re:
            self.finish(json.dumps({'status': 'fail', 'msg': str(re)}))

            # Do check

    def post_remove(self):
        user_id = self.current_user['user_id']
        card_id = self.json_args.get('id')

        key = 'list:easy:card:' + user_id

        index = 0
        try:
            while True:
                line = self.master.lindex(key, index)
                if line is None:
                    raise RuntimeError('删除失败，没有找到需要删除的卡号')

                if line.startswith(card_id):
                    self.master.lrem(key, 0, line)
                    self.master.sdel('set:easy:card:' + user_id, card_id)
                    break
                index += 1

            self.finish(json.dumps({'status': 'ok'}))

        except RuntimeError as re:
            self.finish(json.dumps({'status': 'fail', 'msg': str(re)}))

    def post_reset(self):
        user_id = self.current_user['user_id']
        self.master.delete('set:easy:card:' + user_id)
        self.master.delete('list:easy:card:' + user_id)

        self.finish(json.dumps({'status': 'ok', 'msg': '重置完成'}))

    @tornado.gen.coroutine
    def post_commit(self):
        user_id = self.current_user['user_id']
        status = 'fail'
        msg = ''

        master = self.master

        engine = self.application.engine['machado']
        session = sessionmaker(bind=engine)()

        number_check = self.application.number_check

        try:
            if self.master.exists('flag:task'):
                log_request.info('STOP FLAG FOUND!')
                raise RuntimeError('系统临时维护，请与技术人员联系。')

            if not number_check.is_loaded():
                raise RuntimeError('重复卡号检查器未加载完毕，请稍后再试。')

            # checking
            price0 = None

            card_set = set()
            pass_set = set()
            count = 0

            card_lines = self.master.lrange('list:easy:card:' + user_id, 0, -1)
            if len(card_lines) == 0:
                raise RuntimeError('你还没有输入可提交的卡密')

            for card in card_lines:
                card_id, price, card_pass = card.split(';')

                if price0 is None:
                    price0 = price
                elif price0 != price:
                    raise RuntimeError('价格不一致')

                if card_id in card_set or master.exists('card:%s' % card_id) or number_check.exists(card_id):
                    raise RuntimeError('系统中有重复卡号：%s' % card_id)

                if card_pass in pass_set:
                    raise RuntimeError('系统中有重复密码：%s' % card_id)

                if sinopec_pattern_card.match(card_id) is None:
                    raise RuntimeError('卡号格式不正确(16位)：%s' % card_id)

                if sinopec_pattern_pass.match(card_pass) is None:
                    raise RuntimeError('卡密码不正确(20位) %s' % card_id)

                card_set.add(card_id)
                pass_set.add(card_pass)
                count += 1

            ########
            # CREATE BOX
            tsp = dt.datetime.now()
            part = tsp.strftime('%m')
            uid = master.incr('xid:easy')
            file_name = 'easy_%s_%d.txt' % (tsp.strftime('%Y%m%d'), uid)

            box = Box()
            box.card_type = 'SINOPEC'
            box.user_id = user_id  # for multi-user

            box.partition = part
            box.price = price0

            box.count = count
            box.ready = count
            box.inuse = 0
            box.used = 0
            box.error = 0
            box.invalid = 0

            box.status = 'ready'
            box.filename = file_name
            box.package = str(uid)
            box.create_time = tsp

            # box.target_user = target_user
            box.source = None
            box.buy_price = price0
            box.sell_price = price0

            box.notes = None

            session.add(box)
            session.commit()

            master.hmset('box:%d' % box.id, {
                'count': count,
                'ready': count,
                'inuse': 0,
                'used': 0,
                'error': 0,
                'invalid': 0,
                'user_id': user_id,
                'price': price0,
                'part': part,
                'card_type': 'SINOPEC',
            })

            '''
            INSERT FILE
            '''
            card_part = get_card_shard(part)

            user = self.application.config.get('user').get(user_id)
            aes_pass = user['aes_pass']
            aes_iv = user['aes_iv']

            # two parse
            card_list = []
            for card in card_lines:
                card_id, price, card_pass = card.split(';')
                card_pass = aes_encrypt(card_pass, aes_pass, aes_iv)

                master.hmset('card:%s' % card_id, {
                    'price': price,
                    'password': card_pass,
                    'part': part,
                    'box': box.id,
                    'user_id': user_id,
                    'package': box.package,
                    'create_time': tsp,
                    'file_name': file_name,
                })
                card_list.append(card_id)

                card = card_part()
                card.user_id = user_id
                card.card_id = card_id
                card.box_id = box.id
                card.password = card_pass
                card.price = price
                card.status = 'ready'
                card.create_time = tsp

                session.add(card)

            session.commit()

            number_check.update(card_set)

            # 将上的卡存储到默认上卡卡池
            up_pool = user_id

            master.hmset('box:%d' % box.id, {'pool': up_pool})
            master.sadd('set:card_pool:box_list:{0}:{1}'.format('SINOPEC', up_pool), box.id)

            for card_id in card_list:
                master.lpush('list:card:{0}:{1}:{2}'.format('SINOPEC', up_pool, price0), card_id)

            # ret = {'status': 'ok', 'box_id': box.id, 'count': count, 'price': price0}

            income = price0 * count
            log_request.info('ADD FUND FOR %sx%s', price0, count)

            for _try in range(5):
                r = yield self.post_fund('deposit', '', user_id, income)
                log_request.info('ADD FUND RESULT %s', r)
                if r == 'ok':
                    break
                tornado.gen.sleep(5)

            self.master.delete('set:easy:card:' + user_id)
            self.master.delete('list:easy:card:' + user_id)

            status = 'ok'
            msg = '导入成功'


        except Exception as e:
            log_request.exception('EASY IMPORT FAIL')
            status = 'fail'
            msg = str(e)

        finally:
            session.close()

        self.finish(json.dumps({'status': status, 'msg': msg}))
