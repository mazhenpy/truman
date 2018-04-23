import os
import re
import datetime as dt
import json
import logging

from sqlalchemy.orm import sessionmaker
import subprocess
import xlrd
import tornado.web
import tornado.ioloop
import sys

from utils import aes_encrypt
from db.machado import Box, get_card_shard
from handlers import BaseHandler

from handlers.card import get_file_id
import binascii

log_request = logging.getLogger("machado.request")

pattern_card = re.compile('^\d{5}[0-9][0-9]\d{10}$')
pattern_pass = re.compile('^\d{18}$')

pattern_package = re.compile('(\d{2,5})\.[1-8]')

sinopec_pattern_card = re.compile('^\d{16}$')
sinopec_pattern_pass = re.compile('^\d{20}$')


def to_percent(str):
    if not str:
        return None
    return int(float(str) * 100)


class CardImportHandler(BaseHandler):
    def encrypt_file_by_user(self, path):
        try:
            user_id = self.current_user['user_id']
            user = self.application.config['user'][user_id]

            key = binascii.hexlify(user['aes_pass'].encode()).decode()
            iv = binascii.hexlify(user['aes_iv'].encode()).decode()
            return_code = subprocess.check_call(
                ['openssl', 'aes-256-cbc', '-e', '-K', key, '-iv', iv, '-salt', '-in', path, '-out', path + '.enc'])

            if return_code == 0:
                os.remove(path)
            else:
                log_request.error('ENC FAIL')
        except:
            log_request.exception('FAIL ON ENCRYPT')

    @tornado.web.authenticated
    def get(self, path):
        print("%%%%%%%%%%%%%%%%%%%%%%%%%%")
        if 'card_import' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        self.card_type = self.get_argument('card_type', '')
        if self.card_type == 'CMCC_FEE':
            self.CARD_ID_COL_NUM = 4
            self.CARD_PASS_COL_NUM = 5

        if self.card_type == 'SINOPEC':
            self.CARD_ID_COL_NUM = 1
            self.CARD_PASS_COL_NUM = 2

        if path == '':
            return self.render('card_import.html', card_type=self.card_type,
                               price_list=self.application.config['price'][self.card_type])
        elif path == '/list':
            self.get_list()
        elif path == '/stream':
            self.get_stream()
        else:
            self.send_error(500)

    def get_stream(self):
        return self.finish(json.dumps(self.application.stream))

    def get_list(self):
        file_list = []

        user_id = self.current_user['id']
        file_id_set = self.master.smembers('file:set:%s' % user_id)

        if file_id_set:
            for file_id in file_id_set:
                file_info = self.master.hgetall('file:%s' % file_id)
                file_list.append(file_info)
            file_list = sorted(file_list, key=lambda x: x['filename'])

        return self.finish(json.dumps(file_list))

    @tornado.web.authenticated
    def post(self, path):
        if 'card_import' not in self.current_user['roles']:
            return self.finish()

        self.card_type = self.get_argument('card_type', '')
        if self.card_type == 'CMCC_FEE':
            self.CARD_PRICE_NUM = 1
            self.CARD_ID_COL_NUM = 4
            self.CARD_PASS_COL_NUM = 5
        elif self.card_type == 'SINOPEC':
            self.CARD_PRICE_NUM = 0
            self.CARD_ID_COL_NUM = 1
            self.CARD_PASS_COL_NUM = 2
        else:
            self.send_error(500)

        if path == '/upload':
            self.post_upload()
        elif path == '/commit':
            self.post_commit()
        elif path == '/reset':
            self.post_reset()
        elif path == '/reload':
            self.post_reload()
        else:
            self.send_error(404)

    def post_upload(self):
        """
        SAVE FILE & FIRST PARSE CHECK
        """
        # checking only
        status = 'ok'
        msg = []

        card_set = set()
        pass_set = set()

        number_check = self.application.number_check
        if not number_check.is_loaded():
            status = 'fail'
            msg.append('重复卡号检查器未加载完毕，请稍后再试。')

        price = int(self.get_argument('price'))

        file = self.request.files['card_file'][0]
        file_name = file['filename']
        notes = self.get_argument('notes', '')
        package_no = self.get_argument('package_no', '')
        # target_user = self.get_argument('user_id', None)
        source_id = self.get_argument('source_id', None)

        buy_price = to_percent(self.get_argument('buy_price', None))
        sell_price = to_percent(self.get_argument('sell_price', None))
        card_pool = self.get_argument('card_pool', None)

        user_id = self.current_user['user_id']

        master = self.master

        # 判断此卡池是否是该用户卡池
        up_pools = master.hgetall("map:downstream_user:SINOPEC:{user_id}".format(user_id=user_id))

        if not card_pool in up_pools.values():
            status = 'fail'
            msg.append('当前卡池不在该用户名下')

        if card_pool is None or card_pool == '':
            status = 'fail'
            msg.append('找不到上卡卡池')

        if not self.card_type or self.card_type == '':
            status = 'fail'
            msg.append('找不到卡品')

        if package_no == '':
            p = pattern_package.search(file_name)
            if p:
                package_no = p.group(1)

        if package_no is None or package_no == '':
            status = 'fail'
            msg.append('箱号未指定，无法通过文件名分析')

        try:
            tsp = dt.datetime.now()
            date_part = tsp.strftime('%y%m%d')
            path = os.path.join('files', date_part)
            os.makedirs(path, exist_ok=True)

            # save file
            with open(os.path.join(path, file_name), 'wb') as stream:
                stream.write(file['body'])

            file_id = get_file_id(file_name)
            file_set_key = 'file:set:%s' % self.current_user['id']

            master.hmset('file:%s' % file_id, {
                'filename': file_name,
                'notes': notes,
                'package_no': package_no,
                # 'target_user': target_user,
                'source_id': source_id,
                'buy_price': buy_price,
                'sell_price': sell_price,
                'path': path,
                'card_type': self.card_type,
                'card_pool': card_pool,
                'user_id': user_id,
            })

            master.sadd(file_set_key, file_id)
            master.expire(file_set_key, 3600)

            tsp = dt.datetime.now()

            with xlrd.open_workbook(file_contents=file['body']) as book:
                sheet1 = book.sheet_by_index(0)

                # FAST CHECK
                count = 0
                for n in range(sheet1.nrows):
                    count += 1
                    # read a cell
                    card_id = str(sheet1.cell(n, self.CARD_ID_COL_NUM).value).strip()
                    card_pass = str(sheet1.cell(n, self.CARD_PASS_COL_NUM).value).strip()

                    p = sheet1.cell(n, self.CARD_PRICE_NUM).value
                    if isinstance(p, str) and '元' in p:
                        p = p[:-1]

                    price0 = int(p)

                    if price != price0:
                        status = 'fail'
                        msg.append('第%d行：价格不一致：%s' % (count, card_id))
                        break

                    if master.exists('card:%s' % card_id) or number_check.exists(card_id):
                        status = 'fail'
                        msg.append('第%d行：系统中有重复卡号：%s' % (count, card_id))
                        break

                    if card_id in card_set:
                        status = 'fail'
                        msg.append('第%d行：文件中有重复卡号：%s' % (count, card_id))
                        break

                    if self.card_type == 'SINOPEC':
                        if sinopec_pattern_card.match(card_id) is None:
                            status = 'fail'
                            msg.append('第%d行：卡号格式不正确(16位)：%s' % (count, card_id))
                            break

                        if sinopec_pattern_pass.match(card_pass) is None:
                            status = 'fail'
                            msg.append('第%d行：卡密码不正确(20位) %s' % (count, card_id))
                            break
                    elif self.card_type == 'CMCC_FEE':
                        if pattern_card.match(card_id) is None:
                            status = 'fail'
                            msg.append('第%d行：卡号格式不正确(17位，6,7位为10,16,19,20)：%s' % (count, card_id))
                            break

                        if pattern_pass.match(card_pass) is None:
                            status = 'fail'
                            msg.append('第%d行：卡密码不正确(19位) %s' % (count, card_id))
                            break

                    if card_pass in pass_set:
                        status = 'fail'
                        msg.append('第%d行：文件中卡密码重复 %s' % (count, card_id))
                        break

                    card_set.add(card_id)
                    pass_set.add(card_pass)

            if len(msg) == 0:
                msg.append('检测通过')

            msg = ','.join(msg)
            master.hmset('file:%s' % file_id, {
                'status': status,
                'msg': msg,
                'price': price,
                'count': count
            })

            ret = {'status': status, 'msg': msg}

        except Exception as e:
            log_request.exception('post_upload EXCEPTION')
            ret = {'status': 'fail', 'msg': str(e)}

        self.finish(json.dumps(ret))

    def post_reset(self):
        user_id = self.current_user['id']
        file_id_set = self.master.smembers('file:set:%s' % user_id)

        for file_id in file_id_set:
            self.master.delete('file:%s' % file_id)
            self.master.srem('file:set:%s' % user_id, file_id)

        self.finish(json.dumps({'status': 'ok', 'msg': '重置完成'}))

    def post_reload(self):
        number_check = self.application.number_check
        if not number_check.is_loaded():
            return self.finish(json.dumps({'status': 'fail', 'msg': '未装载完成'}))

        number_check.clean()
        tornado.ioloop.IOLoop.instance().add_callback(number_check.loading)

        self.finish(json.dumps({'status': 'ok', 'msg': '重置完成'}))

    def post_commit(self):
        try:
            # redis
            if self.master.exists('flag:task'):
                log_request.info('STOP FLAG FOUND!')
                return self.finish(json.dumps({'status': 'fail', 'msg': '系统临时维护，请与技术人员联系。'}))

        except Exception as e:
            log_request.exception('GET REDIS FAIL')
            return self.finish(json.dumps({'status': 'fail', 'msg': '系统内部异常!'}))

        file_list = []

        user_id = self.current_user['id']
        file_id_set = self.master.smembers('file:set:%s' % user_id)

        if file_id_set is None:
            self.finish(json.dumps({'status': 'fail', 'msg': '没有需要提交的文件'}))

        card_set = set()
        pass_set = set()
        join_ok = True

        all_pass = True
        for file_id in file_id_set:
            file_info = self.master.hgetall('file:%s' % file_id)
            file_info['file_id'] = file_id
            file_list.append(file_info)

            if file_info.get('status') == 'fail':
                all_pass = False
                # break

            ok, msg = self.pre_commit_check(file_info, card_set, pass_set)
            join_ok = join_ok and ok
            if msg:
                self.master.hmset('file:%s' % file_id, {
                    'status': 'fail',
                    'msg': msg
                })

        if not join_ok:
            self.finish(json.dumps({'status': 'fail', 'msg': '需要提交的文件在合并检查中发现错误，请修正后重新提交'}))
            return

            # if not all_pass:
        # self.finish(json.dumps({'status': 'fail', 'msg': '您上传的文件中有不合格文件，请处理后再提交'}))

        file_list = sorted(file_list, key=lambda x: x['filename'])

        engine = self.application.engine['machado']
        session = sessionmaker(bind=engine)()

        status = 'ok'
        msg = ''

        try:
            for file_info in file_list:
                file_id = file_info['file_id']
                try:

                    status, msg = self.commit_file(file_info, session)
                except Exception as e:
                    status = 'fail'
                    msg = repr(e)

                if status == 'ok':
                    self.master.srem('file:set:%s' % user_id, file_id)
                    self.master.delete('file:%s' % file_id)
                else:
                    self.master.hmset('file:%s' % file_id, {
                        'status': status,
                        'msg': msg})
                    break
        finally:
            session.close()

        self.finish(json.dumps({'status': status, 'msg': msg}))

    def pre_commit_check(self, file_info, card_set, pass_set):
        ok = True
        msg = None

        file_name = file_info['filename']
        file_path = os.path.join(file_info['path'], file_name)

        with xlrd.open_workbook(file_path) as book:
            sheet1 = book.sheet_by_index(0)
            for n in range(sheet1.nrows):
                # read a cell
                card_id = str(sheet1.cell(n, self.CARD_ID_COL_NUM).value).strip()
                card_pass = str(sheet1.cell(n, self.CARD_PASS_COL_NUM).value).strip()

                if card_id in card_set:
                    ok = False
                    msg = '文件中有重复卡号：%s' % card_id
                    break

                if card_pass in pass_set:
                    ok = False
                    msg = '文件中有重复密码：%s' % card_pass
                    break

                card_set.add(card_id)
                pass_set.add(card_pass)

        return ok, msg

    def commit_file(self, file_info, session):

        # checking only
        card_set = set()
        pass_set = set()

        price = int(file_info['price'])

        file_name = file_info['filename']
        file_path = os.path.join(file_info['path'], file_name)
        package_no = file_info['package_no']
        # target_user = file_info['target_user']
        user_id = file_info['user_id']
        source_id = file_info['source_id']
        buy_price = file_info['buy_price']
        sell_price = file_info['sell_price']
        notes = file_info['notes']
        card_type = file_info['card_type']

        master = self.master

        status = 'ok'
        msg = ''

        number_check = self.application.number_check
        if not number_check.is_loaded():
            status = 'fail'
            msg = '重复卡号检查器未加载完毕，请稍后再试。'
            return status, msg

        try:
            tsp = dt.datetime.now()
            part = tsp.strftime('%m')

            with xlrd.open_workbook(file_path) as book:
                sheet1 = book.sheet_by_index(0)

                # FAST CHECK
                count = 0
                for n in range(sheet1.nrows):
                    count += 1
                    # read a cell
                    card_id = str(sheet1.cell(n, self.CARD_ID_COL_NUM).value).strip()
                    card_pass = str(sheet1.cell(n, self.CARD_PASS_COL_NUM).value).strip()

                    p = sheet1.cell(n, self.CARD_PRICE_NUM).value
                    if isinstance(p, str) and '元' in p:
                        p = p[:-1]

                    price0 = int(p)

                    if price != price0:
                        status = 'fail'
                        msg = '价格不一致：%s' % card_id
                        break

                    if master.exists('card:%s' % card_id) or number_check.exists(card_id):
                        status = 'fail'
                        msg = '系统中有重复卡号：%s' % card_id
                        break

                    if card_id in card_set:
                        status = 'fail'
                        msg = '文件中有重复卡号：%s' % card_id
                        break

                    if card_type == 'SINOPEC':
                        if sinopec_pattern_card.match(card_id) is None:
                            status = 'fail'
                            msg = '卡号格式不正确(16位)：%s' % card_id
                            break

                        if sinopec_pattern_pass.match(card_pass) is None:
                            status = 'fail'
                            msg = '卡密码不正确(20位) %s' % card_id
                            break
                    elif card_type == 'CMCC_FEE':
                        if pattern_card.match(card_id) is None:
                            status = 'fail'
                            msg = '卡号格式不正确(17位，6,7位为10,16,19,20)：%s' % card_id
                            break

                        if pattern_pass.match(card_pass) is None:
                            status = 'fail'
                            msg = '卡密码不正确(19位) %s' % card_id
                            break

                    if card_pass in pass_set:
                        status = 'fail'
                        msg = '第%d行：文件中卡密码重复 %s' % (count, card_id)
                        break

                    card_set.add(card_id)
                    pass_set.add(card_pass)

                # SLOW CHECK

                # INPUT
                if status == 'fail':
                    return status, msg

                '''
                CREATE BOX
                '''
                box = Box()
                box.card_type = card_type
                box.user_id = user_id  # for multi-user

                box.partition = part
                box.price = price

                box.count = count
                box.ready = count
                box.inuse = 0
                box.used = 0
                box.error = 0
                box.invalid = 0

                box.status = 'ready'
                box.filename = file_name
                box.package = package_no
                box.create_time = tsp

                # box.target_user = target_user
                box.source = source_id
                box.buy_price = buy_price
                box.sell_price = sell_price

                box.notes = notes

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
                    'price': price,
                    'part': part,
                    'card_type': card_type,
                })

                master.lpush('list:pool:type:{pool_id}:{price}'.format(pool_id=user_id, price=price), box.id)

                '''
                INSERT FILE
                '''
                card_part = get_card_shard(part)

                user = self.application.config.get('user').get(user_id)
                aes_pass = user['aes_pass']
                aes_iv = user['aes_iv']

                # two parse
                card_list = []
                for n in range(sheet1.nrows):
                    # read a cell
                    card_id = str(sheet1.cell(n, self.CARD_ID_COL_NUM).value).strip()
                    card_pass = str(sheet1.cell(n, self.CARD_PASS_COL_NUM).value).strip()

                    if isinstance(card_id, float):
                        card_id = '%.0f' % card_id
                    if isinstance(card_pass, float):
                        card_pass = '%.0f' % card_pass

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

                    master.lpush('list:ready:box:{box_id}'.format(box_id=box.id), card_id)

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

                # 存储到指定卡池之中
                up_pool = file_info['card_pool']

                master.hmset('box:%d' % box.id, {
                    'pool': up_pool
                })
                master.sadd('set:card_pool:box_list:{0}:{1}'.format(card_type, up_pool), box.id)

                for card_id in card_list:
                    master.lpush('list:card:{0}:{1}:{2}'.format(card_type, up_pool, price), card_id)

                ret = {'status': 'ok', 'box_id': box.id, 'count': count, 'price': price}

            # when file closed
            if status == 'ok':
                self.encrypt_file_by_user(file_path)

        except Exception as e:
            log_request.exception('ERROR')
            status = 'fail'
            msg = repr(e)

        return status, msg
