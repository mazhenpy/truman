import json
import logging
import math
import time

import tornado.web
import xlsxwriter
from sqlalchemy import desc

from db.machado import Box, get_card_shard
from handlers import BaseHandler

request_log = logging.getLogger("machado.request")


class CardQueryHandler(BaseHandler):
    @tornado.web.authenticated
    def get(self, path):
        if 'card_query' not in self.current_user['roles']:
            return self.redirect('/auth/login')

        card_type = self.get_argument('card_type')
        self.render('card_query.html', card_type=card_type, price_list=self.application.config['price'][card_type])

    @tornado.web.authenticated
    def post(self, path):
        if 'card_query' not in self.current_user['roles']:
            return self.finish()

        body = self.request.body.decode()
        args = json.loads(body)

        if path == '/box':
            self.query_box(args)
        elif path == '/card':
            self.query_card(args)
        elif path == '/package':
            self.query_package(args)

    def query_box(self, args):
        page = int(args['page'])
        size = int(args['size'])
        status = args['status']
        price = args['price']
        package = args['package']
        card_id = args.get('card_id')
        card_type = args['card_type']

        session = self.session('machado')

        result = []

        q = session.query(Box)

        if status != '':
            q = q.filter(Box.status == status)

        if price != '':
            q = q.filter(Box.price == price)

        if package != '':
            q = q.filter(Box.package == package)

        if 'start' in args and 'end' in args and args['start'] and args['end']:
            start = time.strptime(args['start'], '%Y/%m/%d %H:%M:%S')
            end = time.strptime(args['end'], '%Y/%m/%d %H:%M:%S')
            q = q.filter(Box.create_time >= start).filter(Box.create_time < end)

            # filter by card_id
            if card_id:
                box_id = -1

                box_id_set = set()
                for part in range(1, 13):
                    card_class = get_card_shard(part)
                    card = session.query(card_class).filter(card_class.card_id == card_id).first()
                    if card:
                        box_id_set.add(card.box_id)

                q = q.filter( Box.id.in_(box_id_set) )

        q = q.filter(Box.card_type == card_type)

        if 'admin' not in self.current_user['roles']:
            q = q.filter(Box.user_id == self.current_user['user_id'])
            request_log.info('FILTER USER %s', self.current_user['user_id'])

        count = q.count()

        max_page = int(math.ceil(count / int(args['size'])))

        q = q.order_by(desc(Box.id)).offset((page - 1) * size).limit(size)

        for box in q:
            if not box.update_time:
                box.update_time = box.create_time

            o = {
                'pachage_id': box.package, # 箱号
                'box_id': box.id, # 盒号
                'price': box.price, # 面值
                'filename': box.filename, # 文件名
                'create_time': str(box.create_time), # 上卡时间
                'count':   box.count,      # 总数
                'ready':   box.ready,      # 可用
                'inuse':   box.inuse,      # 在用
                'used' :   box.used,       # 已用
                'error':   box.error,      # 错卡
                'invalid': box.invalid,    # 废卡
                'frozen':  0,     # 冻结的卡
                'removed': 0,    # 删除的卡
                'status':  box.status,     # 状态
                'status_time': str(box.update_time), # 状态时间
            }

            if box.status in ['ready','frozen']:
                box_info = self.slave.hmget('box:%d' % box.id,
                                            ['count', 'ready', 'inuse', 'used', 'error'])
                o['count'] = box_info[0]  # count
                o['ready'] = box_info[1]  # ready
                o['inuse'] = box_info[2]  # inuse
                o['used'] = box_info[3]   # used
                o['error'] = box_info[4]  # error

            result.append(o)

        session.close()

        self.finish(json.dumps({
            'data': result,
            'max': max_page,
            'page': page,
            'size': size
        }))


    def query_package(self, args):
        slave = self.slave

        page = int(args['page'])
        size = int(args['size'])
        status = args['status']
        price = args['price']
        card_type = args['card_type']

        session = self.session('machado')

        result = []

        # session.query(Table.column, func.count(Table.column)).group_by(Table.column).all()
        q = session.query(Box.package).filter(Box.package != None).group_by(Box.package)
        q = q.filter(Box.card_type == card_type)

        if status != '':
            q = q.filter(Box.status == status)

        if price != '':
            q = q.filter(Box.price == price)

        if 'admin' not in self.current_user['roles']:
            q = q.filter(Box.user_id == self.current_user['user_id'])
            request_log.info('FILTER USER %s', self.current_user['user_id'])

        start = None
        end = None
        if 'start' in args and 'end' in args and args['start'] and args['end']:
            start = time.strptime(args['start'], '%Y/%m/%d %H:%M:%S')
            end = time.strptime(args['end'], '%Y/%m/%d %H:%M:%S')
            q = q.filter(Box.create_time >= start).filter(Box.create_time < end)

        count = q.count()

        max_page = int(math.ceil(count / int(args['size'])))

        q = q.order_by(desc(Box.id)).offset((page - 1) * size).limit(size)

        # 共 1 箱 ， 8 盒 2000 张 ， 面值合计 100000 元
        # 其中 可用 2000 张  ， 可用面值合计 100000 元

        package_count = 0
        box_count = 0
        total_count = 0
        ready_count = 0
        total_sum = 0
        ready_sum = 0

        for package, in q:
            package_count += 1

            qb = session.query(Box).filter(Box.package == package)
            if start and end:
                qb = qb.filter(Box.create_time >= start).filter(Box.create_time < end)

            package_info = {
                'name': package,
                'start': None,
                'end': None,
                'price': 0,
                'c': 0,
                'r': 0,
            }
            # 箱号/入库日期/面值/张数/可用

            for box in qb.all():
                box_count += 1

                if package_info['start'] is None or package_info['start'] > box.create_time:
                    package_info['start'] = box.create_time

                if package_info['end'] is None or package_info['end'] < box.create_time:
                    package_info['end'] = box.create_time

                package_info['price'] = box.price

                if box.status == 'ready' and self.slave.exists('box:%d' % box.id):
                    box_info = self.slave.hmget('box:%d' % box.id, ['count', 'ready', 'inuse', 'used', 'error'])
                    package_info['c'] += int(box_info[0])  # count
                    package_info['r'] += int(box_info[1])  # ready

                    total_count += int(box_info[0])
                    ready_count += int(box_info[1])

                    total_sum += int(box_info[0]) * box.price
                    ready_sum += int(box_info[1]) * box.price
                else:
                    package_info['c'] += box.count
                    package_info['r'] += box.ready

                    total_count += box.count * box.price
                    ready_count += box.ready * box.price

            result.append(package_info)

        session.close()

        for x in result:
            x['start'] = x['start'].strftime('%y/%m/%d %H:%M:%S')
            x['end'] = x['end'].strftime('%H:%M:%S')

        self.finish(json.dumps({
            'data': result,
            'max': max_page,
            'page': page,
            'size': size,
            'package_count': package_count,
            'box_count': box_count,
            'total_count': total_count,
            'ready_count': ready_count,
            'total_sum': total_sum,
            'ready_sum': ready_sum,
        }))

    def query_card(self, args):
        box_id = int(args['box'])
        page = int(args['page'])
        size = int(args['size'])
        requ_type = args.get('requ_type', 'query')

        status = None
        if 'status' in args:
            status = args['status']
        else:
            status = 'all'

        session = self.session('machado')

        result = []

        box = session.query(Box).filter(Box.id == box_id).first()

        if box is None:
            return self.finish(json.dumps({'data': {}}))

        card_class = get_card_shard(box.partition)

        q = session.query(card_class).filter(card_class.box_id == box.id)
        if status and status != 'all':
            q = q.filter(card_class.status == status)

        if requ_type == 'query':
            count = q.count()
            # print(count)

            max_page = int(math.ceil(count / int(args['size'])))

            q = q.order_by(card_class.card_id).offset((page - 1) * size).limit(size)

            # 订单编号	手机号	产品名称	运营商	面值	采购金额	开始时间	状态时间	批次号	订单状态	备注
            for card in q:
                if not card.update_time:
                    card.update_time = card.create_time

                o = {
                    'id': card.id,
                    'card_id': card.card_id,
                    'box_id': card.box_id,
                    'price': card.price,
                    # 'pass': card.password,
                    'status': card.status,
                    'site': card.site,
                    'create_time': str(card.create_time),
                    'status_time': str(card.update_time),
                }
                result.append(o)

            session.close()

            self.finish(json.dumps({
                'data': result,
                'max': max_page,
                'page': page,
                'size': size,
                'count': count,
            }))
        elif  requ_type == 'export':
            q = q.order_by(card_class.card_id)
            status_map = {
                'all': '全部',
                'ready': '可用',
                'inuse': '在用',    
                'error': '错卡',
            }

            path = 'exports/card_{0}_{1}.xlsx'.format(box.id, status)
            workbook = xlsxwriter.Workbook(path)
            worksheet = workbook.add_worksheet()

            #写文件头
            worksheet.write(0, 0, '箱号')
            worksheet.write(0, 1, '盒号')
            worksheet.write(0, 2, '文件名')
            worksheet.write(0, 3, '面值')
            worksheet.write(0, 4, '上卡时间')
            worksheet.write(0, 5, '状态')
            worksheet.write(0, 6, '卡号')
            worksheet.write(0, 7, '新密码')

            row = 1
            for card_info in q:
                worksheet.write(row, 0, box.package)
                worksheet.write(row, 1, box.id)
                worksheet.write(row, 2, box.filename)
                worksheet.write(row, 3, box.price)
                worksheet.write(row, 4, str(box.create_time) )
                worksheet.write(row, 5, status_map.get(card_info.status, card_info.status))
                worksheet.write(row, 6, card_info.card_id)

                row += 1

            workbook.close()
            self.finish( json.dumps({'path': '/'+path}) )
