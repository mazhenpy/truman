# -*- coding: utf8 -*-
import json
import logging

from handlers import BaseHandler, JsonHandler
from utils.secret import sign_request
from utils import rand_number

request_log = logging.getLogger("machado.request")


class LogoutHandler(BaseHandler):
    def get(self):
        self.clear_cookie("_token")
        self.redirect("/auth/login")


class LoginHandler(JsonHandler):
    def get(self):
        self.render('login.html')

    def post(self):
        if not {'user', 'password'} <= set(self.json_args):
            return self.write_error(405)

        login = self.json_args.get('user').strip()
        password = self.json_args.get('password')
        o = self.json_args.get('opt')

        if len(login) == 0 or len(password) == 0:
            request_log.error('LOGIN - BAD POST {%s/%s}', login, password)
            return self.finish(json.dumps({'status': 'fail', 'msg': '请完整输入用户名密码和验证码'}))

        # check captcha
        master = self.master

        operator_list = self.application.config.get('operator')
        operator_id = next(filter(lambda id: login == operator_list[id]['login'], operator_list), None)

        if operator_id is None:
            request_log.error('LOGIN - USER ERROR %s', login)
            return self.finish(json.dumps({'status': 'fail', 'msg': '用户名或者密码错'}))

        operator = operator_list[operator_id]

        # merge new password
        if operator_id in self.application.password:
            operator['password'] = self.application.password.get(operator_id)

        roles = None
        if operator['role']:
            roles = self.application.config['role'].get(operator['role'])

        if master.exists('user:%s:lock' % operator_id):
            request_log.error('LOGIN - LOCKED USER %s', login)
            return self.finish(json.dumps({'status': 'fail', 'msg': '该用户已经被锁定，请稍候重试'}))

        if operator['password'] != sign_request(password.encode()):
            # lock
            k = 'user:%s:try' % operator_id
            if master.exists(k):
                if master.incr(k) > 10:
                    master.setex('user:%s:lock' % operator_id, 1, 3600)
            else:
                master.setex(k, 1, 3600)
            request_log.error('LOGIN - ERROR PASSWORD %s/%s', login, password)
            return self.finish(json.dumps({'status': 'fail', 'msg': '用户名或者密码错'}))

        # Token
        token = rand_number.token(16)
        key_token = 'token:%s' % token
        master.set(key_token, operator_id)
        master.expire(key_token, 3600)

        # user:*
        k = 'operator:%s' % operator_id

        master.hmset(k, {
            'name': operator['login'],
            'password': operator['password'],
            'role': operator['role'],
            'user_id': operator['user_id'],
            'display_name': operator['name']
        })

        # role:*
        if roles:
            k = 'role:%s' % operator_id
            master.delete(k)
            master.sadd(k, *roles)

        self.set_cookie("_token", token)
        self.finish(json.dumps({'status': 'ok'}))

        request_log.info('LOGIN - SUCCESS %s %s', login, roles)
