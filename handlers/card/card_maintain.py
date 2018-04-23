import json
import logging
from datetime import datetime
import time
import tornado.web
import xlsxwriter
from sqlalchemy import and_
from sqlalchemy.orm import sessionmaker
from db.machado import get_card_shard, Box, OperationLog
from handlers import JsonHandler, JsonHandler2

log = logging.getLogger("machado.request")


class CardMaintainHandler(JsonHandler2):
    @tornado.web.authenticated
    def post(self):
        if 'card_maintain' not in self.current_user['roles']:
            return self.finish()

        log.info("CardMaintainHandler REQU: {0}".format(self.request.body))

        #冻结卡
        if self.requ_type == 'freeze':
            return self.freeze_card()

        #解冻卡
        elif self.requ_type == 'unfreeze':
            return self.unfreeze_card()

        #删除
        elif self.requ_type == 'remove':
            return self.remove_card()

        return self.resp_json_result('fail', '未知请求')


    # 冻结卡操作流程
    def freeze_card(self):
        type = self.argu_list['type']
        id = self.argu_list['id']

        if type == 'card_id':
            return self.freeze_by_card_id(id)
        elif type == 'box_id':
            return self.freeze_by_box_id(id)
        elif type == 'package_no':
            return self.freeze_by_package_no(id)

        return self.resp_json_result('fail', '未知处理类型')

    def freeze_by_card_id(self, card_id):
        return self.resp_json_result('fail', 'under construction!!!')


    def freeze_by_box_id(self, box_id):
        #redis中查找盒号信息并获取卡所在表
        box_key = 'box:{0}'.format(box_id)
        redis_box_info  = self.master.hgetall(box_key)
        if not redis_box_info:
            return self.resp_json_result('fail', '找不到该盒卡的信息')

        card_part = get_card_shard(redis_box_info['part'])

        #1.修改数据库中的盒状态
        #2.修改数据库中的卡状态
        #3.删除redis中的盒数据和卡数据
        db_session = self.session('machado')
        try:
            #查询数据库数据
            db_box_info = db_session.query(Box).filter(Box.id == box_id).one_or_none()
            if db_box_info == None:
                return self.resp_json_result('fail', '无法查询到本盒卡的数据')

            #判断用户ID是否匹配
            if db_box_info.user_id != self.user_id and 'admin' not in self.current_user['roles']:
                return self.write_error(403)

            #判断本盒状态是否合法
            if db_box_info.status != 'ready':
                return self.resp_json_result('fail', '非法的修改状态')

            #记录操作日志
            operation_log = OperationLog()
            operation_log.operator_id = self.current_user['id']
            operation_log.operation = 'freeze'
            operation_log.object_id = box_id
            operation_log.object_type = 'box'
            operation_log.create_date = datetime.now()
            db_session.add(operation_log)


            #修改每张卡的状态
            db_session.query(card_part).filter( and_(card_part.box_id == box_id,card_part.status == 'ready')).update({'status': 'frozen', 'update_time': datetime.now() })

            #修改盒状态
            db_box_info.update_time = datetime.now()
            db_box_info.status = 'frozen'
            db_session.add(db_box_info)
            db_session.commit()

            #redis修改  移出可用表里面的卡号
            freeze_count = 0
            card_list_key = 'list:card:{0}:{1}:{2}'.format(redis_box_info['card_type'], redis_box_info['pool'], redis_box_info['price'])
            ready_card_list = db_session.query(card_part.card_id).filter( and_(card_part.box_id == box_id,card_part.status == 'frozen') ).all()
            for card in ready_card_list:
                result = self.master.lrem(card_list_key, 0, card.card_id)
                if result == 0:
                    log.warning('freeze_by_box_id LREM ERROR BOX {0} CARD_ID {1} !!!'.format(box_id, card.card_id))
                else:
                    log.info('freeze_by_box_id LREM SUCCESS BOX {0} CARD_ID {1}'.format(box_id, card.card_id))
                    freeze_count += 1

            if freeze_count != int(redis_box_info['ready']):
                    log.warning('freeze_by_box_id BOX {0}  READY_COUNT {1} != FREEZE_COUNT {2} !!!'.format(box_id, redis_box_info['ready'], freeze_count))

            self.master.hset(box_key, 'status', 'frozen')

            return self.resp_json_result('ok', '冻结成功')
        except:
            log.exception('freeze_by_box_id {0} EXCEPTION!!!'.format(box_id))
            return self.resp_json_result('fail', '冻结异常')
        finally:
            db_session.close()


    def freeze_by_package_no(self, package_no):
        return self.resp_json_result('fail', 'under construction!!!')

    # 解冻卡操作流程
    def unfreeze_card(self):
        type = self.argu_list['type']
        id = self.argu_list['id']

        if type == 'card_id':
            return self.unfreeze_by_card_id(id)
        elif type == 'box_id':
            return self.unfreeze_by_box_id(id)
        elif type == 'package_no':
            return self.unfreeze_by_package_no(id)
        else:
            return self.resp_json_result('fail', 'unkonwn request!!!')

    def unfreeze_by_card_id(self, card_id):
        return self.resp_json_result('fail', 'under construction!!!')


    def unfreeze_by_box_id(self, box_id):
        #redis中查找盒号信息并获取卡所在表
        box_key = 'box:{0}'.format(box_id)
        redis_box_info  = self.master.hgetall(box_key)
        if not redis_box_info:
            return self.resp_json_result('fail', '找不到该盒卡的信息')

        card_part = get_card_shard(redis_box_info['part'])

        #1.修改数据库中的盒状态
        #2.修改数据库中的卡状态
        #3.将卡数据添加到redis中
        db_session = self.session('machado')
        try:
            #查询数据库数据
            db_box_info = db_session.query(Box).filter(Box.id == box_id).one_or_none()
            if db_box_info == None:
                return self.resp_json_result('fail', '无法查询到本盒卡的数据')

            #判断用户ID是否匹配
            if db_box_info.user_id != self.user_id and 'admin' not in self.current_user['roles']:
                return self.write_error(403)

            #判断本盒状态是否合法
            if db_box_info.status != 'frozen':
                return self.resp_json_result('fail', '非法的修改状态')

            #记录操作日志
            operation_log = OperationLog()
            operation_log.operator_id = self.current_user['id']
            operation_log.operation = 'unfreeze'
            operation_log.object_id = box_id
            operation_log.object_type = 'box'
            operation_log.create_date = datetime.now()
            db_session.add(operation_log)

            #修改每张卡的状态
            db_session.query(card_part).filter( and_(card_part.box_id == box_id,card_part.status == 'frozen')).update({'status': 'ready', 'update_time': datetime.now() })

            #修改盒状态
            db_box_info.update_time = datetime.now()
            db_box_info.status = 'ready'
            db_session.add(db_box_info)
            db_session.commit()

            #redis修改  将卡移到可用数据表
            unfreeze_count = 0
            card_list_key = 'list:card:{0}:{1}:{2}'.format(redis_box_info['card_type'], redis_box_info['pool'], redis_box_info['price'])
            ready_card_list = db_session.query(card_part.card_id).filter( and_(card_part.box_id == box_id,card_part.status == 'ready') ).all()
            for card in ready_card_list:
                #先判断redis中是否有此卡的数据信息
                if self.slave.exists('card:{0}'.format(card.card_id)):
                    self.master.rpush(card_list_key, 0, card.card_id)
                    unfreeze_count += 1
                    log.info('unfreeze_by_box_id RPUSH SUCCESS BOX {0} CARD_ID {1} TO {2}'.format(box_id, card.card_id, card_list_key))
                else:
                    log.warning('unfreeze_by_box_id RPUSH ERROR BOX {0} CARD_ID {1} !!!'.format(box_id, card.card_id))

            if unfreeze_count != int(redis_box_info['ready']):
                    log.warning('unfreeze_by_box_id BOX {0}  READY_COUNT {1} != UNFREEZE_COUNT {2} !!!'.format(box_id, redis_box_info['ready'], unfreeze_count))

            self.master.hset(box_key, 'status', 'ready')

            return self.resp_json_result('ok', '解冻成功')
        except:
            log.exception('unfreeze_by_box_id {0} EXCEPTION!!!'.format(box_id))
            return self.resp_json_result('fail', '解冻异常')
        finally:
            db_session.close()


    def unfreeze_by_package_no(self, package_no):
        return self.resp_json_result('fail', 'under construction!!!')


    def remove_card(self):
        type = self.argu_list['type']
        id = self.argu_list['id']
        if type == 'box_id':
            return self.remove_by_box_id(id)

        return self.resp_json_result('fail', '不支持的类型')


    #根据盒号卸卡
    def remove_by_box_id(self, box_id):
        #redis中查找盒号信息并获取卡所在表
        box_key = 'box:{0}'.format(box_id)
        redis_box_info  = self.master.hgetall(box_key)
        if not redis_box_info:
            return self.resp_json_result('fail', '找不到该盒卡的信息')

        card_part = get_card_shard(redis_box_info['part'])

        #1.修改数据库中的盒状态
        #2.修改数据库中的卡状态
        #3.将卡数据添加到redis中
        db_session = self.session('machado')
        try:
            #查询数据库数据
            db_box_info = db_session.query(Box).filter(Box.id == box_id).one_or_none()
            if db_box_info == None:
                return self.resp_json_result('fail', '无法查询到本盒卡的数据')

            #判断用户ID是否匹配
            if db_box_info.user_id != self.user_id and 'admin' not in self.current_user['roles']:
                return self.write_error(403)

            #判断本盒状态是否合法
            if db_box_info.status != 'frozen':
                return self.resp_json_result('fail', '非法的修改状态')

            #判断卡的数量是否符合规则
            if redis_box_info['count'] != redis_box_info['ready']:
                return self.resp_json_result('fail', '暂时不支持删除被使用过的卡盒')

            #记录操作日志
            operation_log = OperationLog()
            operation_log.operator_id = self.current_user['id']
            operation_log.operation = 'remove'
            operation_log.object_id = box_id
            operation_log.object_type = 'box'
            operation_log.create_date = datetime.now()
            db_session.add(operation_log)

            #修改每张卡的状态
            db_session.query(card_part).filter( and_(card_part.box_id == box_id,card_part.status == 'frozen')).update({'status': 'removed', 'update_time': datetime.now() })

            #修改盒状态
            db_box_info.update_time = datetime.now()
            db_box_info.status = 'removed'
            db_box_info.count = redis_box_info['count']
            db_box_info.ready = redis_box_info['ready']
            db_box_info.inuse = redis_box_info['inuse']
            db_box_info.used = redis_box_info['used']
            db_box_info.error = redis_box_info['error']
            db_session.add(db_box_info)
            db_session.commit()

            #删除redis中存储的每张卡的数据
            remove_count = 0
            ready_card_list = db_session.query(card_part).filter( and_(card_part.box_id == box_id, card_part.status == 'removed') ).all()
            for card in ready_card_list:
                if self.master.delete('card:{0}'.format(card.card_id)) == 1:
                    remove_count += 1
                    log.info('remove_by_box_id DELETE CARD SUCCESS BOX {0} CARD_ID {1}'.format(box_id, card.card_id))
                else:
                    log.warning('remove_by_box_id DELETE CARD ERROR BOX {0} CARD_ID {1} !!!'.format(box_id, card.card_id))

                #删除重复卡号加载器中的数据
                self.application.number_check.remove(card.card_id)

            #删除redis中存储的卡盒数据
            if self.master.delete('box:{0}'.format(box_id)) != 1:
                log.warning('remove_by_box_id DELETE BOX ERROR BOX {0}!!!'.format(box_id))

            if remove_count != int(redis_box_info['ready']):
                log.warning('remove_by_box_id BOX {0}  READY_COUNT {1} != REMOVE_COUNT {2} !!!'.format(box_id, redis_box_info['ready'], remove_count))

            return self.resp_json_result('ok', '删除成功')
        except:
            log.exception('remove_by_box_id {0} EXCEPTION!!!'.format(box_id))
            return self.resp_json_result('fail', '删除本盒卡出现异常，请联系管理员， ID={0}'.format(box_id))
        finally:
            db_session.close()


class ExportErrorCards(JsonHandler):

    @tornado.gen.coroutine
    @tornado.web.authenticated
    def post(self):
        if 'card_query' not in self.current_user['roles']:
            return self.finish()

        filename = 'cuokajilu.xlsx'.format(datetime.now().strftime("%Y%m%d_%H%M%S"))
        print("XXXXXX", filename)
        workbook = xlsxwriter.Workbook(filename)
        worksheet = workbook.add_worksheet()

        worksheet.write(0, 0, '面值')
        worksheet.write(0, 1, '文件名')
        worksheet.write(0, 2, '时间')
        worksheet.write(0, 3, '卡号')
        worksheet.write(0, 4, '密码')

        # redis查找所有的盒号
        index = 1
        card_list = self.master.keys("card:*")
        card_list = sorted(card_list)
        for card_key in card_list:
            card_id = card_key[card_key.find(':') + 1:]

            card = self.master.hgetall("card:{0}".format(card_id))
            if not (card.get('state') and card['state'] == 'error'):
                continue

            if card.get('create_time'):
                create_time = card['create_time'][:19]
            else:
                create_time = 'unknown'

            worksheet.write(index, 0, card.get('price', 'unknown'))
            worksheet.write(index, 1, card.get('file_name', 'unknown'))
            worksheet.write(index, 2, create_time)
            worksheet.write(index, 3, card_id)
            # worksheet.write(index, 4, card['password'])
            index += 1

            if index % 100 == 0:
                yield tornado.gen.sleep(0.1)


        workbook.close()

        response = json.dumps({'status': 'ok', 'msg': 'success', 'data': filename})
        return self.finish(response)
