import struct

import numpy as np

# Redis imports
import redis
from redis.commands.search.query import Query
from redis.commands.search.field import TextField, VectorField
from redis.commands.search.indexDefinition import IndexDefinition


class RedisHelper:
    def __init__(self, host: str, port: int, db: int, logger=None):
        self.host = host
        self.port = port
        self.db = db
        self.logger = logger or print

        self.client = None

    def connect(self):
        try:
            self.client = redis.Redis(self.host, self.port, self.db)
            self.client.ping()
            return True
        except Exception as e:
            self.logger(f"[ERROR] Could not connect to Redis: {e}")
            return False

    # Redis commands
    def keys(self, pattern: str):
        return self.client.keys(pattern)

    def hgetall(self, key: str):
        return self.client.hgetall(key)

    def hget(self, name: str, key: str):
        return self.client.hget(name, key)

    def copy(self, src: str, dst: str, replace: bool = False):
        if replace:
            self.client.delete(dst)
        return self.client.copy(src, dst)

    def hset(
        self,
        name: str,
        key: str | None = None,
        value: str | None = None,
        mapping: dict | None = None,
        items: list | None = None,
    ):
        return self.client.hset(name, key, value, mapping, items)

    def hdel(self, name: str, *keys: str):
        if not keys:
            return 0
        return self.client.hdel(name, *keys)

    def delete(self, name: str):
        if isinstance(name, list):
            return self.client.delete(*name)
        return self.client.delete(name)

    def ft(self, index_name: str = "idx"):
        return self.client.ft(index_name)

    def search(
        self,
        query: str | Query,
        query_params: dict[str, str | int | float | bytes] | None = None,
    ):
        return self.client.search(query, query_params)

    def exists(self, key: str):
        return self.client.exists(key)

    def hexists(self, name: str, key: str):
        return self.client.hexists(name, key)

    def scan(self, cursor: int = 0, match: str = None, count: int = None):
        return self.client.scan(cursor, match, count)

    def sadd(self, name: str, *values):
        return self.client.sadd(name, *values)

    def smembers(self, name: str):
        return self.client.smembers(name)

    def srem(self, name: str, *values):
        return self.client.srem(name, *values)

    def pipeline(self):
        return self.client.pipeline()

    # Custom commands
    def decode_object(self, data: dict):
        decoded = {}
        for key, value in data.items():
            try:
                decoded[key.decode("utf-8")] = value.decode("utf-8")
            except Exception as _:
                decoded[key.decode("utf-8")] = value

        return decoded

    def embedding_encode(self, embedding: np.ndarray):
        h, w = embedding.shape
        size = struct.pack(">ff", h, w)
        return size + embedding.tobytes()

    def embedding_decode(self, data: bytes, dtype: np.dtype = np.float32):
        h, w = struct.unpack(">ff", data[:8])
        return np.frombuffer(data[8:], dtype).reshape(int(h), int(w))

    def create_new_index(
        self,
        index_name: str,
        doc_prefix: str,
        fields: list[TextField | VectorField],
        mute: bool = True,
    ):
        try:
            self.client.ft(index_name).info()
            if not mute:
                self.logger("[INFO] Index already exists")

        except redis.exceptions.ResponseError:
            self.client.ft(index_name).create_index(
                fields=fields, definition=IndexDefinition(prefix=[doc_prefix])
            )
            if not mute:
                self.logger(f'[INFO] Index "{index_name}" created')
