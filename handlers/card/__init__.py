import hashlib

__author__ = 'Kevin'


def get_file_id(name):
    m = hashlib.md5()
    m.update(name.encode('utf8'))
    return m.hexdigest()