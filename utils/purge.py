from redis.sentinel import Sentinel
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
import yaml
from db.machado import Box, get_card_shard


def purge(pattern):
    cfg = yaml.load(open('config.yaml', 'r'))
    sentinels = [(c['ip'], c['port']) for c in cfg['cache']]
    sentinel = Sentinel(sentinels, socket_timeout=0.1, decode_responses=True, db=6)

    master = sentinel.master_for('machado')

    engine = create_engine(
        cfg['database']['machado'],
        pool_size=2,
        echo=True,
        echo_pool=True,
        pool_recycle=3600)

    session = sessionmaker(bind=engine)()

    try:
        q = session.query(Box).filter(Box.filename.like(pattern + '%'))

        for box in q.all():
            print(box)
            part = box.partition

            card_part = get_card_shard(part)
            q2 = session.query(card_part).filter(card_part.box_id == box.id)

            for card in q2.all():
                price = card.price
                card_id = card.card_id
                print('REMOVE CARD %s %d' % (card_id, master.lrem('list:card:%d' % price, 0, card_id)))

                master.delete('card:%s' % card_id)

                session.delete(card)

            master.delete('box:%d' % box.id)
            session.delete(box)

        session.commit()

    finally:
        session.close()


if __name__ == '__main__':
    purge('xl1415')
