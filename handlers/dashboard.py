# -*- coding: utf8 -*-
import tornado.ioloop
import tornado.httpserver
import tornado.web

from handlers import BaseHandler


class DashboardHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self):
        self.render('dashboard.html', remote_ip=self.request.remote_ip)
