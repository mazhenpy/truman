import base64
import binascii
import os
import random
import string

from Crypto.Cipher import AES


__author__ = 'Kevin'


def pad(s):
    return s + (16 - len(s) % 16) * chr(16 - len(s) % 16)


def token(size):
    return binascii.hexlify(os.urandom(size)).decode("utf8")


def gen_key(size, chars=None):
    if chars is None:
        chars = string.ascii_lowercase + string.ascii_uppercase + string.digits

    return ''.join(random.choice(chars) for _ in range(size))


def aes_encrypt(text, password, iv):
    aes = AES.new(password, AES.MODE_CBC, iv)
    encrypted = aes.encrypt(pad(text))
    return base64.b64encode(encrypted).decode()
