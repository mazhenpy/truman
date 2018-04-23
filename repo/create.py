# -*- coding: utf8 -*-

import hashlib
import random
import string
import xlsxwriter
import yaml

PREFIX_MAP = {
    '0': '0',
    '1': '1',
    '2': '2',
    '3': '3',
    '4': '4',
    '5': '5',
    '6': '6',
    '7': '7',
    '8': '8',
    '9': '9',
    'a': '0',
    'b': '1',
    'c': '2',
    'd': '3',
    'e': '4',
    'f': '5',
}

set_password = set()


def gen_key(size):
    chars = string.digits
    return ''.join(random.choice(chars) for _ in range(size))


def check_num(p):
    m = hashlib.md5()
    m.update(p.encode('utf8'))
    return PREFIX_MAP.get(m.hexdigest()[0])


def create():
    cfg = yaml.load(open('create.yaml', 'r'))

    start = cfg['batch']['start']
    count = cfg['batch']['count']
    downstream = cfg['batch']['downstream']
    batch_id = cfg['batch']['batch_id']

    path = '%s.%s.xlsx' % (downstream, batch_id)

    workbook = xlsxwriter.Workbook(path)
    worksheet = workbook.add_worksheet()
    worksheet.set_column(0, 1, 15)

    worksheet.write(0, 0, '卡号')
    worksheet.write(0, 1, '密码')

    for n in range(count):
        card_number = '%s%s%06d' % (downstream, batch_id, start + n)
        check = check_num(card_number)

        while True:
            card_pass = gen_key(13)
            new_pass = card_pass[:11] + check + card_pass[12:]

            if new_pass in set_password:
                continue

            set_password.add(new_pass)
            break

        print(card_number, check, new_pass)
        worksheet.write(n + 1, 0, card_number)
        worksheet.write(n + 1, 1, new_pass)

    workbook.close()


if __name__ == '__main__':
    create()
