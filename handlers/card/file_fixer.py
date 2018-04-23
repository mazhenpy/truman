import re
import datetime as dt
import json
import logging

from sqlalchemy.orm import sessionmaker
import xlrd
import tornado.web
import xlsxwriter

from utils import aes_encrypt
from db.machado import Box, get_card_shard
from handlers import BaseHandler


log_request = logging.getLogger("machado.request")

pattern_card = re.compile('^\d{5}10\d{10}$')
pattern_pass = re.compile('^\d{18}$')


class CardFixerHandler(BaseHandler):
    def get(self, path):
        self.render('card_fixer.html')

    def post(self, path):
        if path == '/upload':
            self.upload()
        else:
            self.finish()

    def upload(self):
        card_set = set()

        lines = int(self.get_argument('lines'))
        card_id = self.get_argument('card_id')

        if card_id.isdigit():
            card_id = int(card_id)
        else:
            card_id = 0

        f = self.request.files['card_file'][0]
        print(f)

        ret = {'status': 'fail'}

        fail = None

        try:
            workbook = xlsxwriter.Workbook(f['filename'])
            worksheet = workbook.add_worksheet()

            with xlrd.open_workbook(file_contents=f['body']) as book:
                sheet1 = book.sheet_by_index(0)

                # FAST CHECK
                count = 0
                for n in range(lines):
                    count += 1
                    # read a cell
                    # card_id = str(sheet1.cell(n, 4).value).strip()
                    card_pass = str(sheet1.cell(n, 5).value).strip()

                    print(card_id)
                    card_id += 1

                    worksheet.write(n, 1, str(card_id))

                ret = {'status': 'success', 'msg': fail}

                workbook.close()

                ret = {'status': 'ok', 'msg': f['filename']}

        except Exception as e:
            log_request.exception('ERROR')
            ret = {'status': 'fail', 'msg': str(e)}

        self.finish(json.dumps(ret))
