import json

import tornado.ioloop
import tornado.httpserver
import tornado.web
from sqlalchemy.orm import sessionmaker

__author__ = 'Kevin'

import tornado.web


class EchoHandler(tornado.web.RequestHandler):
    def head(self):
        self.finish()

    def get(self):
        print('ECHO {0} {1}'.format('GET', self.request.uri))
        self.finish()

    def post(self):
        print('ECHO {0} {1} {2}'.format('POST', self.request.uri, self.request.body))
        self.finish()


class BaseHandler(tornado.web.RequestHandler):
    def __init__(self, application, request, **kwargs):
        super(BaseHandler, self).__init__(application, request)
        self._master = None
        self._slave = None

    @property
    def master(self):
        if self._master is None:
            self._master = self.application.sentinel.master_for('machado')
        return self._master

    @property
    def slave(self):
        if self._slave is None:
            self._slave = self.application.sentinel.slave_for('machado')
        return self._slave

    def session(self, name):
        if name in self.application.engine:
            engine = self.application.engine[name]
            return sessionmaker(bind=engine)()
        return None

    def get_current_user(self):
        token = self.get_cookie("_token")
        if token:
            key = 'token:%s' % token
            operator_id = self.master.get(key)
            self.master.expire(key, 1800)  # reset token ttl

            if operator_id:
                operator = self.master.hgetall('operator:' + operator_id)
                operator['id'] = operator_id
                operator['roles'] = self.master.smembers("role:" + operator_id)

                return operator

        return None


class JsonHandler(BaseHandler):
    def __init__(self, application, request, **kwargs):
        super(JsonHandler, self).__init__(application, request)
        self.json_args = None

    def prepare(self):
        if self.request.method == 'POST':
            b = self.request.body
            # print(b)
            try:
                self.json_args = json.loads(b.decode('utf8'))
            except:
                self.json_args = {}


class ReactContentHandler(BaseHandler):
    def __init__(self, application, request, path, **kwargs):
        super(ReactContentHandler, self).__init__(application, request, **kwargs)
        self.path = path

    @tornado.web.authenticated
    def get(self):
        self.render(self.path)


class JsonHandler2(BaseHandler):
    def __init__(self, application, request, **kwargs):
        super(JsonHandler2, self).__init__(application, request)

    def resp_json_result(self, status, msg,data=None):
        resp_data = {'status':status, 'msg':msg, 'data':data}
        #log.info("RESP: {0}".format(resp_data))

        resp_data = json.dumps(resp_data)
        return self.finish(resp_data)

    @tornado.web.authenticated
    def prepare(self):
        if self.request.method == 'GET':
            #log.info("GET: {0} {1}".format(self.request.uri, self.request.arguments))
            args = {}
            for argument in self.request.arguments:
                if argument != 'requ_type':
                    args[argument] = self.get_argument(argument)

            self.args = args
            self.requ_type = self.get_argument('requ_type', None)
            self.argu_list = args

        elif self.request.method == 'POST':
            requ_body = self.request.body.decode()
            #log.info("POST: {0} {1}".format(self.request.uri, requ_body))
            args = json.loads( requ_body )

            self.args = args
            self.requ_type = args['requ_type']
            self.argu_list = args.get('argu_list', {})

        self.user_id  = self.current_user['user_id']