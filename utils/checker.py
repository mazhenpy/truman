from sys import getsizeof
from sqlalchemy.orm import sessionmaker
from tornado.ioloop import IOLoop
from tornado import gen

from db.machado import get_card_shard


class NumberChecker():
    def __init__(self, application):
        self.application = application
        self.loaded = False
        self.card_set = set()

    def is_loaded(self):
        return self.loaded

    def exists(self, number):
        return number in self.card_set

    def update(self, number_set):
        self.card_set.update(number_set)

    def remove(self, number):
        if number in self.card_set:
            self.card_set.remove(number)
            return True

        return False

    def clean(self):
        self.card_set = set()
        self.loaded = False

    @gen.coroutine
    def loading(self):
        engine = self.application.engine['machado']
        session = sessionmaker(bind=engine)()

        try:
            for partition in range(1, 12):
                card_cls = get_card_shard(partition)

                current = -1
                p = -1
                while True:
                    q = session.query(card_cls.id, card_cls.card_id).filter(card_cls.id > current).filter(card_cls.status != 'removed').order_by(
                        card_cls.id).limit(1000)

                    for xid, card_id in q.all():
                        p = xid
                        cid = int(card_id)

                        if cid in self.card_set:
                            print('INVALID %s' % cid)
                        else:
                            self.card_set.add(cid)

                    if p == current:
                        break
                    else:
                        current = p

                    yield gen.Task(IOLoop.instance().add_timeout, 1)

            self.loaded = True
            print('Full loaded, size=%dm.' % (getsizeof(self.card_set) / 1024 / 1024))

        finally:
            session.close()
