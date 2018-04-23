# coding=utf8
from handlers import JsonHandler
import tornado

class AdminDownstreamCardPoolHandler(JsonHandler):

    @tornado.web.authenticated
    def get(self):
        if 'admin' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        self.card_type = self.get_argument('card_type')
        return self.render('admin_downstream_card_pool.html', card_type=self.card_type)
