from sqlalchemy import Column, Integer, String, DateTime
from sqlalchemy.ext.declarative import declarative_base

Base = declarative_base()

'''
CREATE TABLE box (
    id int(11)  NOT NULL AUTO_INCREMENT,
    card_type   VARCHAR(50) NOT NULL,
    partition   INT(11),
    count       INT(11),
    price       INT(11),
    ready       INT(11),
    inuse       INT(11),
    used        INT(11),
    error       INT(11),
    invalid     INT(11),
    status      VARCHAR(30),
    filename    VARCHAR(500),
    package     VARCHAR(20),
    create_time DATETIME,
    update_time DATETIME,
    notes       VARCHAR(2000),
    user_id     VARCHAR(10),
    source      VARCHAR(20),
    buy_price   BIGINT(20),
    sell_price  BIGINT(20),
    PRIMARY KEY (id)
);

-- ALTER TABLE `box` CHANGE user_id target_user VARCHAR(10);
ALTER TABLE `box` ADD COLUMN `user_id` VARCHAR(10) AFTER card_type;
'''


class Box(Base):
    __tablename__ = 'box'

    id = Column(Integer, primary_key=True)
    user_id = Column(String)
    card_type = Column(String)

    partition = Column(Integer)
    count = Column(Integer)
    price = Column(Integer)

    ready = Column(Integer)
    inuse = Column(Integer)
    used = Column(Integer)
    error = Column(Integer)
    invalid = Column(Integer)

    status = Column(String)
    filename = Column(String)
    package = Column(String)

    notes = Column(String)

    source = Column(String)  # new
    buy_price = Column(Integer)  # new
    sell_price = Column(Integer)  # new

    create_time = Column(DateTime)
    update_time = Column(DateTime)


'''
CREATE TABLE card_01 (
    id          BIGINT(20) NOT NULL,
    box_id      INT(11),
    card_id     VARCHAR(20),
    password    VARCHAR(500),
    price       INT(11),
    status      VARCHAR(45),
    create_time DATETIME,
    update_time TIMESTAMP,
    site        VARCHAR(100),
    PRIMARY KEY (id)
);
CREATE INDEX IDX_CARD_ID ON card_01 (card_id);

ALTER TABLE `card_01` ADD COLUMN `user_id`      VARCHAR(50) NULL AFTER id;
ALTER TABLE `card_01` ADD COLUMN `order_id`     VARCHAR(50) NULL AFTER site;
ALTER TABLE `card_01` ADD COLUMN `target_user`  VARCHAR(50) NULL AFTER order_id;

'''


class Card(Base):
    __abstract__ = True

    id = Column(Integer, primary_key=True)
    user_id = Column(String)
    card_id = Column(String)
    box_id = Column(String)
    password = Column(String)
    price = Column(Integer)
    status = Column(String)
    site = Column(String)
    create_time = Column(DateTime)
    update_time = Column(DateTime)

    target_user = Column(String)
    order_id = Column(String)


card_parts = {}


def get_card_shard(part):
    if isinstance(part, int):
        part = '%02d' % part

    if part not in card_parts:
        card_parts[part] = type('Card_' + part, (Card,),
                                {'__tablename__': 'card_' + part})
    return card_parts[part]

'''
CREATE TABLE `operation_log` (
	`id` INT(11) NOT NULL AUTO_INCREMENT,
	`operator_id` VARCHAR(20) NOT NULL COMMENT '操作者ID',
	`operation` VARCHAR(50) NOT NULL COMMENT '动作',
	`object_type` VARCHAR(50) NOT NULL COMMENT '被操作对象的类型',
	`object_id` VARCHAR(50) NOT NULL COMMENT '被操作对象的ID',
	`create_date` DATETIME NOT NULL COMMENT '操作时间',
	`notes` VARCHAR(500) NULL DEFAULT '' COMMENT '备注',
	PRIMARY KEY (`id`)
)
COMMENT='维护操作日志记录'
COLLATE='utf8_general_ci'
ENGINE=InnoDB
;
'''
class OperationLog(Base):
    __tablename__ = 'operation_log'

    id = Column(Integer, primary_key=True, autoincrement=True)
    operator_id = Column(String)
    operation = Column(String)
    object_type = Column(String)
    object_id = Column(String)
    create_date = Column(DateTime)
    notes = Column(String)
