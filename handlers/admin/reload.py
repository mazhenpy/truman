import logging
import tornado.web

request_log = logging.getLogger("machado.request")

class ReloadHandler(tornado.web.RequestHandler):
    def get(self):
        request_log.info('ACCESS RELOAD (%s)', self.request.remote_ip)
        if self.request.remote_ip not in ['127.0.0.1', '::1']:
            return self.send_error(403)

        try:
            self.application.load_config()
            request_log.exception('RELOAD CONFIG SUCCESS')
            return self.finish("RELOAD CONFIG SUCCESS")
        except Exception as e:
            request_log.exception('RELOAD FAIL EXCEPTION')
            return self.finish('RELOAD FAIL %s' % repr(e))

