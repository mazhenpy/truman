# encoding: utf-8
import hashlib
import json
import logging
import yaml
import shutil
import time

from handlers import BaseHandler

request_log = logging.getLogger("machado.request")


def signature(*parts):
    m = hashlib.md5()
    for p in parts:
        m.update(p.encode('utf8'))
    return m.hexdigest().upper()


class ConfigHandler(BaseHandler):
    def post(self):
        request_log.info('CONFIG START')

        try:
            safety = self.application.config.get('safety')
            if safety is None:
                request_log.error('CONFIG FAIL (NO SAFETY)')
                return self.send_error(500)

            # verify ip in white list
            if self.request.remote_ip not in safety['white_list']:
                request_log.error("CONFIG FAIL ('%s'NOT IN WHITELIST)",
                                  self.request.remote_ip)
                return self.send_error(500)

            # verify key
            tsp0 = self.request.headers['tsp']
            encrypted0 = self.request.headers['v']
            encrypted1 = signature(tsp0 + safety['secret'])

            if encrypted1 != encrypted0:
                request_log.error('CONFIG FAIL (SECRET FAIL)')
                return self.send_error(500)

            # SAFETY NOW :)

            # reload
            body = self.request.body.decode()
            cfg = yaml.load(body)

            if cfg:
                # basic check
                d1 = len(cfg.get('user'))
                d0 = len(self.application.config.get('user'))
                delta = abs((d1 - d0) * 100 / d0)
                request_log.info('CONFIG DELTA %.3f', delta)

                tsp = time.strftime("%m%d%H%M%S", time.localtime())

                # back config
                shutil.copy('users.yaml', 'users.yaml.%s' % tsp)

                # write config
                with open('users.tmp', 'w', encoding='utf8') as stream:
                    stream.write(body)

                if delta > 10 and abs(d1 - d0) > 10:
                    request_log.error('CONFIG FAIL DELTA %.3f', delta)
                    return self.send_error(500)

                shutil.move('users.tmp', 'users.yaml')

                self.application.config['user'] = cfg.get('user')
                self.application.config['operator'] = cfg.get('operator')

                request_log.info('CONFIG SYNCED')
                self.finish(json.dumps({'status': 'ok'}))

                check_sinopec_user(cfg.get('user'), self.master)
                return

        except Exception as e:
            request_log.exception('CONFIG SYNC FAIL')

        self.send_error(500)


def check_sinopec_user(user_list, master):
    for user_id in user_list:
        # check pool by user_id
        k = 'map:card_pool_info:%s:%s' % ('SINOPEC', user_id)
        if not master.exists(k):
            master.hmset(k, {'pool_name': user_id, 'display_name': '私有卡池', 'need_cache': 1,
                             'create_tsp': int(time.time())})
        else:
            master.hmset(k, {'pool_name': user_id, 'display_name': '私有卡池', 'need_cache': 1})

        k = 'map:downstream_user:%s:%s' % ('SINOPEC', user_id)
        if not master.exists(k):
            master.hmset(k, {
                'user_id': user_id,
                'user_name': user_list[user_id]['name'],
                'card_pool_seq_list': [
                    'card_pool_seq1', 'card_pool_seq2', 'card_pool_seq3', 'card_pool_seq4', 'card_pool_seq5'],
                'card_pool_seq1': user_id,
                'card_pool_seq2': 'common',
                'card_pool_seq3': '',
                'card_pool_seq4': '',
                'card_pool_seq5': '',
            })
        else:
            master.hmset(k, {'card_pool_seq1': user_id})

    k = 'map:card_pool_info:SINOPEC:common'

    if not master.exists(k):
        master.hmset(k, {'pool_name': 'common', 'display_name': '公共卡池',
                         'need_cache': 1, 'create_tsp': int(time.time())})
    else:
        master.hmset(k, {'pool_name': 'common', 'display_name': '公共卡池'})
