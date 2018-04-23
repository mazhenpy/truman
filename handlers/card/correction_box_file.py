import json
import logging
import re

import xlrd
import xlsxwriter

from db.machado import Box, get_card_shard
from handlers import BaseHandler
from utils import aes_encrypt

log = logging.getLogger("machado.request")

#
class CorrectionBoxFileHandler(BaseHandler):
    cmccfee_pattern_card = re.compile('^\d{5}[0-9][0-9]\d{10}$')
    cmccfee_pattern_pass = re.compile('^\d{18}$')

    sinopec_pattern_card = re.compile('^\d{16}$')
    sinopec_pattern_pass = re.compile('^\d{20}$')

    def post(self):
        if 'card_query' not in self.current_user['roles']:
            return self.send_error(403)

        err_msg = []
        resp_result = {
            'status': 'fail',
            'msg': err_msg
        }

        self.user_id  = self.current_user['user_id']

        self.card_type = self.get_argument('card_type')
        box_id = self.get_argument('box_id')

        pattern_card = None
        pattern_pass = None
        if self.card_type == 'CMCC_FEE':
            pattern_card = self.cmccfee_pattern_card
            pattern_pass = self.cmccfee_pattern_pass
        elif self.card_type == 'SINOPEC':
            pattern_card = self.sinopec_pattern_card
            pattern_pass = self.sinopec_pattern_pass
        else:
            return self.send_error(403)

        file = self.request.files['correction_cards'][0]
        file_name = file['filename']

        card_id_set = set()
        card_pass_set = set()
        card_list = {}

        #检测盒号信息
        redis_box_info  = self.master.hgetall('box:{0}'.format(box_id))
        if not redis_box_info:
            err_msg.append('找不到该盒卡的数据')
            return self.finish(json.dumps(resp_result))

        try:
            self.db_session = self.session('machado')
            query = self.db_session.query(Box).filter(Box.id == box_id)
            if 'admin'  not in self.current_user['role']:
                    query = query.filter(Box.user_id == self.user_id)

            db_box_info = query.one_or_none()
            if not db_box_info:
                err_msg.append('找不到盒号 {0} 的信息'.format(box_id))
                return self.finish(json.dumps(resp_result))
        finally:
            self.db_session.close()

        #检测卡号和卡密
        try:
            with xlrd.open_workbook(file_contents=file['body']) as book:
                sheet1 = book.sheet_by_index(0)

                for i in range(1, sheet1.nrows):
                    line_num = i + 1

                    card_id =  sheet1.cell(i, 6).value
                    card_pass = sheet1.cell(i,7).value

                    if isinstance(card_id, float):
                        card_id = '%.0f' % card_id
                    if isinstance(card_pass, float):
                        card_pass = '%.0f' % card_pass



                    if card_id in card_id_set:
                        card_id_set.add(card_id)
                        err_msg.append('第{0}行存在重复卡号 {1}'.format(line_num, card_id))

                    if pattern_card.match(card_id) is None:
                        err_msg.append('第{0}行卡号{1}格式不正确'.format(line_num, card_pass))

                    if card_pass in card_pass_set:
                        card_pass_set.add(card_pass_set)
                        err_msg.append('第{0}行存在重复卡密 {1}'.format(line_num, card_pass))

                    if pattern_pass.match(card_pass) is None:
                        err_msg.append('第{0}行卡密{1}格式不正确'.format(line_num, card_pass))

                    card_list[card_id] = card_pass
        except Exception:
            log.exception('CorrectionBoxFileHandler read file exception')

            err_msg.append('数据异常')
            return self.finish(json.dumps(resp_result))

        if len(err_msg):
            return self.finish(json.dumps(resp_result))


        #根据盒号信息检测卡号信息是否存在
        db_err_card_list = {}
        card_class = get_card_shard(db_box_info.partition)
        try:
            self.db_session = self.session('machado')

            q = self.db_session.query(card_class).filter(card_class.box_id == db_box_info.id, card_class.status == 'error')
            for card_info in q:
                db_err_card_list[card_info.card_id] = None
        finally:
            self.db_session.close()

        #判断错卡状态是否正确
        for card_id in card_list:
            if card_id not in db_err_card_list:
                err_msg.append('卡号 {0} 状态非法,或者不属于本盒卡'.format(card_id))
            else:
                db_err_card_list[card_id] = card_list[card_id]


        #更新错卡卡密
        user_id = db_box_info.user_id
        user = self.application.config.get('user').get(user_id)
        aes_pass = user['aes_pass']
        aes_iv = user['aes_iv']

        try:
            self.db_session = self.session('machado')
            for card_id in db_err_card_list:
                card_pass = db_err_card_list[card_id]
                if not card_pass:
                    continue

                card_pass = aes_encrypt(card_pass, aes_pass, aes_iv)

                #更新卡的状态
                card = self.db_session.query(card_class).filter(card_class.box_id == db_box_info.id, card_class.card_id == card_id).one()
                card.password = card_pass
                card.status = db_box_info.status
                self.db_session.add(card)
                self.db_session.commit()

                self.master.hincrby('box:%s' % box_id, 'error', -1)
                self.master.hincrby('box:%s' % box_id, 'ready', 1)

                log.info('USER[{0}] MODIFE CARD_PASS BOX[{1}] CARD[{2}] OLD_CARD_PASS[3] >> NEW_CARD_PASS[{4}]'.format(self.current_user['id'], box_id, card_id, self.master.hget('card:%s' % card_id, 'password'), card_pass))
                self.master.hmset('card:%s' % card_id, {'password': card_pass})


                if card.status == 'ready':
                    card_list_key = 'list:card:{0}:{1}:{2}'.format(redis_box_info['card_type'], redis_box_info['pool'], redis_box_info['price'],)
                    self.master.rpush(card_list_key, card.card_id)

        finally:
            self.db_session.close()

        resp_result['status'] = 'ok'
        return self.finish(json.dumps(resp_result))