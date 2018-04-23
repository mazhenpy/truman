# -*- coding: utf8 -*-
import json
import logging
import tornado.web
import yaml

from handlers import JsonHandler
from utils.secret import sign_request

request_log = logging.getLogger("machado.request")


class PasswordHandler(JsonHandler):
    @tornado.web.authenticated
    def get(self):
        # self.current_user['role_name'] = utils.escape_role(self.current_user['role'])
        self.render('password.html')

    @tornado.web.authenticated
    def post(self):
        if not {'old_pass', 'new_pass'} <= set(self.json_args):
            return self.write_error(405)

        o = self.json_args.get('old_pass')
        n = self.json_args.get('new_pass')

        if len(o) == 0 or len(n) == 0:
            request_log.error('CHANGE - BAD POST {%s/%s}', o, n)
            return self.finish(json.dumps({'status': 'fail', 'msg': '请完整输入用户名密码和验证码'}))

        if len(n) < 6:
            request_log.error('CHANGE - BAD POST {%s/%s}', o, n)
            return self.finish(json.dumps({'status': 'fail', 'msg': '您输入的新密码过于简单，请重新输入'}))

        master = self.master

        # check password
        operator_id = self.current_user['id']
        try:
            operator = self.application.config.get('operator').get(operator_id)

            if operator is None:
                request_log.error('CHANGE - OPERATOR IS NULL')
                return self.finish(json.dumps({'status': 'fail', 'msg': '用户信息异常'}))

            if master.exists('user:%s:lock' % operator_id):
                request_log.error('CHANGE - LOCKED OPERATOR %s', operator_id)
                return self.finish(json.dumps({'status': 'fail', 'msg': '该用户已经被锁定，请稍候重试'}))

            # merge new password
            if operator_id in self.application.password:
                operator['password'] = self.application.password.get(operator_id)

            if operator['password'] != sign_request(o.encode()):
                # lock
                k = 'user:%s:try' % operator_id
                if master.exists(k):
                    if master.incr(k) > 10:
                        master.setex('user:%s:lock' % operator_id, 1, 3600)
                else:
                    master.setex(k, 1, 3600)
                request_log.error('CHANGE - ERROR PASSWORD %s/%s', operator['id'], o)
                return self.finish(json.dumps({'status': 'fail', 'msg': '原密码输入错'}))

            operator['password'] = sign_request(n.encode())

            self.application.password[operator_id] = operator['password']
            yaml.dump(self.application.password, open('password.yaml', 'w'))

            self.finish(json.dumps({'status': 'ok'}))
            request_log.info('CHANGE - SUCCESS')

        except Exception as e:
            request_log.exception('CHANGE - EXCEPTION')
