import logging
import logging.config
import time
from datetime import datetime

from redis.sentinel import Sentinel
from sqlalchemy import create_engine, func
from sqlalchemy.orm import sessionmaker
import yaml

from db.machado import Box, get_card_shard

task_log = logging.getLogger("machado.task")


class BoxTask():
    def __init__(self, _config):

        sentinels = [(c['ip'], c['port']) for c in _config['cache']['hosts']]
        self.sentinel = Sentinel(sentinels, socket_timeout=0.1, db=_config['cache']['db'], decode_responses=True)

        engine = create_engine(
            _config['database']['machado'],
            pool_size=2, echo=True, echo_pool=True, pool_recycle=3600)

        self.session = sessionmaker(bind=engine)

    def history(self):
        task_log.debug('TASK BOX START')
        master = self.sentinel.master_for('machado')

        session = self.session()

        try:
            # save finished order & up_order
            # two_days = dt.datetime.now() - dt.timedelta(days=2)
            # filter(Box.create_time <= two_days)
            qb = session.query(Box).filter(Box.status == 'ready').order_by(Box.id)

            for box in qb.all():
                used = 0
                card_class = get_card_shard(box.partition)

                qc = session.query(card_class.status, func.count(card_class.status)).filter(
                    card_class.box_id == box.id).group_by(card_class.status)

                all_status = {'ready': 0, 'inuse': 0, 'used': 0, 'error': 0, 'invalid': 0}

                for status, count in qc.all():
                    task_log.info('%s=%d', status, count)
                    all_status[status] = count
                    if status in ['used', 'invalid']:
                        used += count

                box.ready = all_status['ready']
                box.inuse = all_status['inuse']
                box.used = all_status['used']
                box.error = all_status['error']
                box.invalid = all_status['invalid']

                if box.ready == box.count:
                    task_log.info('TASK BOX SKIP %s', box.id)
                    continue

                if used == box.count:
                    task_log.info('TASK BOX ARCHIVED %s', box.id)
                    box.status = 'archived'
                    box.update_time = datetime.now()
                else:
                    task_log.info('TASK BOX UPDATE %s', box.id)

                session.add(box)
                session.commit()

                if used == box.count:
                    card_type,up_pool = master.hmget('box:%d' % box.id, 'card_type', 'pool')
                    master.srem('set:card_pool:box_list:{0}:{1}'.format(card_type, up_pool), box.id)

                    master.expire('box:%d' % box.id, 24 * 3600)
                    task_log.info('TASK BOX TO REMOVED %s', box.id)

        except Exception as e:
            task_log.exception('TASK BOX FAIL')
        finally:
            session.rollback()
            session.close()
            task_log.debug('TASK BOX FINISH')


if __name__ == "__main__":

    cfg = yaml.load(open('logging-task-box.yaml', 'r'))
    logging.config.dictConfig(cfg)

    config = yaml.load(open('config.yaml', 'r', encoding='utf8'))

    task = BoxTask(config)
    while True:
        task.history()
        time.sleep(60 * 60)
