# -*- coding: utf8 -*-
import logging
import math
import json
import time

import tornado.ioloop
import tornado.httpserver
import tornado.web
from tornado import gen
import xlsxwriter
import tornado.ioloop
import tornado.httpserver
import tornado.web
from sqlalchemy import desc, or_

from db.machado import get_card_shard

from handlers import BaseHandler


PRODUCT_LIST = ['fee', 'data']

request_log = logging.getLogger("machado.request")


class ErrorQueryHandler(BaseHandler):
    def __init__(self, application, request, **kwargs):
        super(ErrorQueryHandler, self).__init__(application, request)
        self.product_cache = {}

    @tornado.web.authenticated
    def get(self, product):
        self.render('error_query.html')

    @tornado.web.authenticated
    def post(self, product):

        if product not in PRODUCT_LIST:
            return self.finish()

        args = self.json_args

        page = int(args['page'])
        size = int(args['size'])

        if 'admin' in self.current_user['roles'] and 'user_id' in args:
            user_id = args['user_id']
        else:
            user_id = self.current_user['partner_id']

        session = self.session('madeira')

        result = []

        if 'master' in self.application.config['downstream'][user_id]:
            master_id = self.application.config['downstream'][user_id]['master']
        else:
            master_id = user_id

        card_cls = get_card_shard(1)

        q = session.query(card_cls).filter(card_cls.status == 'error')

        count = q.count()

        max_page = int(math.ceil(count / int(args['size'])))

        q = q.order_by(desc(card_cls.req_time)) \
            .offset((page - 1) * size) \
            .limit(size)

        # 订单编号	手机号	产品名称	运营商	面值	采购金额	开始时间	状态时间	批次号	订单状态	备注
        for order in q:
            carrier = ''
            carrier_name = ''
            area = ''
            if order.area and ':' in order.area:
                carrier, area = order.area.split(':')

            o = {
                'id': order.order_id,
                'sp_id': order.sp_order_id,
                'phone': order.mobile,
                'price': '%d' % int(order.price),
                'value': (order.value is not None and '%.3f' % (order.value / 10000)) or '-',
                'create': str(order.req_time),
                'update': order.back_time and str(order.back_time),
                'result': self.decode_status(order),
                'balance': (order.balance is not None and '%0.03f' % (order.balance / 10000)) or '-',
            }
            result.append(o)

        session.close()

        self.write(json.dumps({
            'data': result,
            'max': max_page,
            'page': page,
            'size': size
        }))


class OrderExportHandler(ErrorQueryHandler):
    @gen.coroutine
    @tornado.web.authenticated
    def post(self, product):

        if product not in PRODUCT_LIST:
            return self.finish()

        args = self.json_args

        if 'admin' in self.current_user['roles'] and 'user_id' in args:
            user_id = args['user_id']
        else:
            user_id = self.current_user['partner_id']

        if 'master' in self.application.config['downstream'][user_id]:
            master_id = self.application.config['downstream'][user_id]['master']
        else:
            master_id = user_id

        session = self.session('madeira')

        order_cls = get_order_shard(master_id)

        q = session.query(order_cls).filter(order_cls.product == product)
        f = False
        # filter
        if 'number' in args and args['number']:
            q = q.filter(order_cls.mobile == args['number'])
            f = True
        if 'start' in args and 'end' in args and args['start'] and args['end']:
            start = time.strptime(args['start'], '%Y/%m/%d %H:%M:%S')
            end = time.strptime(args['end'], '%Y/%m/%d %H:%M:%S')
            q = q.filter(order_cls.req_time >= start).filter(order_cls.req_time < end)
            f = True
        if 'result' in args and args['result']:
            q = q.filter(or_(order_cls.back_result == args['result'], order_cls.result == args['result']))
            f = True
        if 'id' in args and args['id']:
            q = q.filter(order_cls.order_id == args['id'])
            f = True
        if 'sp_id' in args and args['sp_id']:
            q = q.filter(order_cls.sp_order_id == args['sp_id'])
            f = True

        if not f:
            return self.write(json.dumps({'status': 'fail', 'msg': '您未选择任何过滤条件，请至少输入一个'}))

        q = q.order_by(desc(order_cls.req_time)).limit(100000)

        path = 'exports/export_%s.xlsx' % self.current_user['partner_id']
        workbook = xlsxwriter.Workbook(path)
        worksheet = workbook.add_worksheet()

        worksheet.write(0, 0, '订单编号')
        worksheet.write(0, 1, '代理商订单编号')
        worksheet.write(0, 2, '手机号')
        worksheet.write(0, 3, '产品名称')
        worksheet.write(0, 4, '运营商')
        worksheet.write(0, 5, '面值')
        worksheet.write(0, 6, '采购金额')
        worksheet.write(0, 7, '开始时间')
        worksheet.write(0, 8, '订单状态')
        worksheet.write(0, 9, '状态时间')
        worksheet.write(0, 10, '余额')

        row = 1
        # 订单编号	手机号	产品名称	运营商	面值	采购金额	开始时间	状态时间	批次号	订单状态	备注
        for order in q:
            carrier = ''
            carrier_name = ''
            area = ''
            if order.area and ':' in order.area:
                carrier, area = order.area.split(':')

            worksheet.write(row, 0, order.order_id)
            worksheet.write(row, 1, order.sp_order_id)
            worksheet.write(row, 2, order.mobile)
            row += 1

            if row % 1000 == 0:
                yield gen.moment

        workbook.close()
        session.close()

        self.write(json.dumps({'status': 'ok', 'path': path}))