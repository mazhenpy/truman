# coding=utf8
import logging
import logging.config
import os.path
import tornado.httpserver
import tornado.ioloop
import tornado.web
import yaml
from redis.sentinel import Sentinel
from sqlalchemy import create_engine
from handlers import EchoHandler, ReactContentHandler
from handlers import uimodules
from handlers.admin.card_distribution import AdminCardDistributionHandler
from handlers.admin.card_pool_list import AdminCardPoolListHandler
from handlers.admin.config import ConfigHandler, check_sinopec_user
from handlers.admin.downstream_card_pool import AdminDownstreamCardPoolHandler
from handlers.admin.reload import ReloadHandler
from handlers.auth.login import LoginHandler, LogoutHandler
from handlers.auth.password import PasswordHandler
from handlers.card.card_import import CardImportHandler
from handlers.card.card_maintain import CardMaintainHandler, ExportErrorCards
from handlers.card.correction_box_file import CorrectionBoxFileHandler
from handlers.card.easy_import import ApiEasyImportHandler
from handlers.card.modify import CardModifyHandler
from handlers.card.query import CardQueryHandler
from handlers.dashboard import DashboardHandler
from tasks.supply import SupplyTask
from utils.checker import NumberChecker

LOGO = r'''
  ___ ___                                _________     ___________
 /   |   \_____ ______________ ___.__.  /   _____/     \__    ___/______ __ __  _____ _____    ____
/    ~    \__  \\_  __ \_  __ <   |  |  \_____  \        |    |  \_  __ \  |  \/     \\__  \  /    \
\    Y    // __ \|  | \/|  | \/\___  |  /        \       |    |   |  | \/  |  /  Y Y  \/ __ \|   |  \
 \___|_  /(____  /__|   |__|   / ____| /_______  / /\    |____|   |__|  |____/|__|_|  (____  /___|  /
       \/      \/              \/              \/  \/                               \/     \/     \/

Fork from machado-DOMESTIC
(C) 2014,2015 Quxun Network
'''


# powered by http://patorjk.com/software/taag


class Application(tornado.web.Application):
    def __init__(self):
        self.load_config()

        handlers = [
            (r"/", tornado.web.RedirectHandler, {"url": "/dashboard"}),
            (r"/dashboard", DashboardHandler),

            # auth
            (r"/auth/login", LoginHandler),
            (r"/auth/logout", LogoutHandler),
            (r"/auth/password", PasswordHandler),

            # card
            (r"/card/import(.*)", CardImportHandler),
            (r"/card/query(.*)", CardQueryHandler),
            (r"/card/modify(.*)", CardModifyHandler),
            (r"/card/easy_import", ReactContentHandler, {'path': 'card_easy_import.html'}),
            (r"/api/easy_import/(.*)", ApiEasyImportHandler),

            (r"/upload/correction_box_file", CorrectionBoxFileHandler),

            # api
            (r"/api/card/maintain", CardMaintainHandler),
            (r"/api/card/export_error_cards", ExportErrorCards),

            # admin
            (r"/admin/card_pool_list", AdminCardPoolListHandler),
            (r"/admin/card_distribution", AdminCardDistributionHandler),
            (r"/admin/admin_downstream_card_pool", AdminDownstreamCardPoolHandler),
            (r"/admin/reload", ReloadHandler),
            (r"/admin/config", ConfigHandler),

            # assets
            (r"/(.*html)", tornado.web.StaticFileHandler, {"path": "static"}),
            (r"/((assets|css|js|img|fonts)/.*)", tornado.web.StaticFileHandler, {"path": "static"}),
            (r"/(.*xlsx)", tornado.web.StaticFileHandler, {'path': ''}),
            (r"/.*", EchoHandler),
        ]

        settings = dict(
            template_path=os.path.join(os.path.dirname(__file__), "templates"),
            ui_modules=uimodules,
            cookie_secret='VoGTaZcHTAKHF7cIL1/ZxFQxfNT/jEPNrE6KtgBQgVg=',
            login_url="/auth/login",
            debug=self.if_debug,
        )

        tornado.web.Application.__init__(self, handlers, **settings)

        check_sinopec_user(self.config['user'], self.sentinel.master_for('machado'))

        self.number_check = NumberChecker(self)

    def load_config(self):
        # Loading configuration ...
        self.config = yaml.load(open('config.yaml', 'r', encoding='utf8'))
        if os.path.exists('users.yaml'):
            cfg = yaml.load(open('users.yaml', 'r', encoding='utf8'))
            self.config['user'] = cfg['user']
            self.config['operator'] = cfg['operator']

        self.stream = yaml.load(open('stream.yaml', 'r', encoding='utf8'))
        self.password = yaml.load(open('password.yaml', 'r', encoding='utf8'))
        self.if_debug = self.config['config']['debug']

        # Logging...
        cfg = yaml.load(open('logging.yaml', 'r'))
        logging.config.dictConfig(cfg)

        #database configuration...
        self.engine = {}
        for db in self.config['database']:
            self.engine[db] = create_engine(
                self.config['database'][db],
                pool_size=2,
                echo=True,
                echo_pool=True,
                pool_recycle=3600)

        sentinels = [(c['ip'], c['port']) for c in self.config['cache']['hosts']]
        self.sentinel = Sentinel(sentinels, socket_timeout=0.2, decode_responses=True, db=self.config['cache']['db'])


if __name__ == "__main__":
    print(LOGO)
    application = Application()
    http_server = tornado.httpserver.HTTPServer(application, xheaders=True)
    http_server.listen(9901)
    print('Listen on http://localhost:9901/')

    SupplyTask(application, 10 * 1000).start()

    ioloop = tornado.ioloop.IOLoop.instance()
    ioloop.add_callback(application.number_check.loading)
    ioloop.start()
