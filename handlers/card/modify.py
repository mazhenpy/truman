import json
import logging

from sqlalchemy.orm.exc import NoResultFound
import tornado.web

from db.machado import get_card_shard, Box
from handlers import BaseHandler
from utils import aes_encrypt

request_log = logging.getLogger("machado.request")


class CardModifyHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self, path):
        if 'card_query' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        card_id = self.get_argument('id', '')
        box_id = self.get_argument('box', '')
        card_type = self.get_argument('card_type')

        self.render('card_modify.html', card_type=card_type, card_id=card_id, box_id=box_id)

    @tornado.web.authenticated
    def post(self, path):
        if 'card_query' not in self.current_user['roles']:
            return self.finish()

        self.user_id  = self.current_user['user_id']

        body = self.request.body.decode()
        args = json.loads(body)

        if not {'box_id', 'card_id', 'password', 'no_modify'} <= set(args):
            return self.finish(json.dumps({'status': 'fail', 'msg': '输入异常'}))

        box_id = args['box_id']
        card_id = args['card_id']
        password = args['password']
        no_modify = args['no_modify']

        session = None
        try:
            session = self.session('machado')

            #数据库中查询卡盒信息
            db_box_info =  None
            query = session.query(Box).filter(Box.id == box_id)
            if 'admin'  not in self.current_user['role']:
                query = query.filter(Box.user_id == self.user_id)

            db_box_info = query.one_or_none()
            if db_box_info == None:
                return self.finish(json.dumps({'status': 'fail', 'msg': '卡盒信息出错'}))

            #redis查询单张卡的信息
            partition = self.slave.hget('card:%s' % card_id, 'part')
            if partition is None:
                return self.finish(json.dumps({'status': 'fail', 'msg': '卡信息错 %s' % partition}))

            card_class = get_card_shard(partition)

            query = session.query(card_class).filter(card_class.card_id == card_id, card_class.box_id == box_id)
            if 'admin'  not in self.current_user['role']:
                query = query.filter(card_class.user_id == self.user_id)

            card = query.one_or_none()
            if card is None:
                return self.finish(json.dumps({'status': 'fail', 'msg': '无效的卡(%s)' % card_id}))

            if card.status != 'error':
                return self.finish(json.dumps({'status': 'fail', 'msg': '无效的状态(%s)' % card.status}))

            card_pass = None
            if not no_modify:
                user_id = card.user_id
                user = self.application.config.get('user').get(user_id)
                aes_pass = user['aes_pass']
                aes_iv = user['aes_iv']

                card_pass = aes_encrypt(password, aes_pass, aes_iv)
                card.password = card_pass

            card.status = db_box_info.status
            session.add(card)
            session.commit()

            # update box
            self.master.hincrby('box:%s' % box_id, 'error', -1)
            self.master.hincrby('box:%s' % box_id, 'ready', 1)

            # update Caching
            request_log.info('USER[{0}] MODIFE CARD_PASS BOX[{1}] CARD[{2}] OLD_CARD_PASS[{3}] >> NEW_CARD_PASS[{4}]'.format(self.current_user['id'], box_id, card_id, self.master.hget('card:%s' % card_id, 'password'), card_pass))
            if card_pass:
                self.master.hset('card:%s' % card_id, 'password', card_pass)

            # 判断是否需要挪到可用列表
            if card.status == 'ready':
                card_type,pool = self.master.hmget('box:{0}'.format(box_id), 'card_type', 'pool')
                card_list_key = 'list:card:{0}:{1}:{2}'.format(card_type, pool, card.price)
                self.master.rpush(card_list_key, card.card_id)

            self.finish(json.dumps({'status': 'ok', 'msg': '成功'}))

        except Exception as e:
            request_log.exception('UPDATE CARD ERROR')
            self.finish(json.dumps({'status': 'fail', 'msg': '未知异常'}))
        finally:
            if session:
                session.close()
