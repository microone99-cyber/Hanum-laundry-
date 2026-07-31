"""
Lapisan kompatibilitas: meniru sebagian kecil API Motor/MongoDB (find_one,
find, count_documents, insert_one, update_one, delete_one) tapi datanya
disimpan di SQLite (1 file, tanpa koneksi jaringan sama sekali).

Setiap "collection" MongoDB (mis. db.users, db.pesanan) dipetakan ke satu
tabel SQLite dengan 2 kolom: id (TEXT, primary key) dan data (TEXT, isinya
JSON dari dokumen). Query MongoDB sederhana (equality, $regex, $gte, $lte)
dievaluasi di Python terhadap dokumen yang sudah di-load sebagai dict.

Ini cukup untuk skala toko laundry kecil (ratusan-ribuan baris), jadi
loading semua baris ke memori untuk difilter itu aman dan sederhana.
"""
import json
import re
import sqlite3
import threading
from typing import Any, Optional


def _match(doc: dict, query: Optional[dict]) -> bool:
    if not query:
        return True
    for key, cond in query.items():
        val = doc.get(key)
        if isinstance(cond, dict):
            for op, target in cond.items():
                if op == "$regex":
                    if val is None or not re.match(target, str(val)):
                        return False
                elif op == "$gte":
                    if val is None or not (val >= target):
                        return False
                elif op == "$lte":
                    if val is None or not (val <= target):
                        return False
                elif op == "$ne":
                    if val == target:
                        return False
                else:
                    # operator tidak dikenal -> anggap tidak cocok, aman by default
                    return False
        else:
            if val != cond:
                return False
    return True


class Cursor:
    def __init__(self, docs: list):
        self._docs = docs
        self._sort_field = None
        self._sort_dir = 1
        self._limit = None

    def sort(self, field: str, direction: int = 1):
        self._sort_field = field
        self._sort_dir = direction
        return self

    def limit(self, n: int):
        self._limit = n
        return self

    async def to_list(self, n: Optional[int] = None):
        docs = list(self._docs)
        if self._sort_field:
            docs.sort(key=lambda d: (d.get(self._sort_field) is None, d.get(self._sort_field)),
                      reverse=(self._sort_dir < 0))
        limit = self._limit if self._limit is not None else n
        if limit is not None:
            docs = docs[:limit]
        return docs

    def __aiter__(self):
        self._iter = iter(self._docs)
        return self

    async def __anext__(self):
        try:
            return next(self._iter)
        except StopIteration:
            raise StopAsyncIteration


class Collection:
    def __init__(self, conn: sqlite3.Connection, lock: threading.Lock, name: str):
        self._conn = conn
        self._lock = lock
        self._table = f"col_{name}"
        with self._lock:
            self._conn.execute(
                f"CREATE TABLE IF NOT EXISTS {self._table} (id TEXT PRIMARY KEY, data TEXT NOT NULL)"
            )
            self._conn.commit()

    def _all(self) -> list:
        cur = self._conn.execute(f"SELECT data FROM {self._table}")
        return [json.loads(row[0]) for row in cur.fetchall()]

    async def find_one(self, query: Optional[dict] = None) -> Optional[dict]:
        for d in self._all():
            if _match(d, query):
                return d
        return None

    def find(self, query: Optional[dict] = None, projection: Optional[dict] = None) -> Cursor:
        docs = [d for d in self._all() if _match(d, query)]
        if projection:
            include = [k for k, v in projection.items() if v == 1 and k != "_id"]
            docs = [{k: d.get(k) for k in include} for d in docs]
        return Cursor(docs)

    async def count_documents(self, query: Optional[dict] = None) -> int:
        return sum(1 for d in self._all() if _match(d, query))

    async def insert_one(self, doc: dict) -> dict:
        doc_id = doc.get("id")
        if doc_id is None:
            raise ValueError("Dokumen harus punya field 'id'")
        with self._lock:
            self._conn.execute(
                f"INSERT INTO {self._table} (id, data) VALUES (?, ?)",
                (doc_id, json.dumps(doc)),
            )
            self._conn.commit()
        return doc

    async def update_one(self, query: dict, update: dict) -> None:
        for d in self._all():
            if _match(d, query):
                if "$set" in update:
                    d.update(update["$set"])
                with self._lock:
                    self._conn.execute(
                        f"UPDATE {self._table} SET data=? WHERE id=?",
                        (json.dumps(d), d["id"]),
                    )
                    self._conn.commit()
                return

    async def delete_one(self, query: dict) -> None:
        for d in self._all():
            if _match(d, query):
                with self._lock:
                    self._conn.execute(f"DELETE FROM {self._table} WHERE id=?", (d["id"],))
                    self._conn.commit()
                return


class Database:
    """Pengganti `db = client[DB_NAME]` dari Motor. Akses `db.nama_koleksi`
    otomatis membuat/menggunakan tabel SQLite yang sesuai."""

    def __init__(self, path: str):
        self._conn = sqlite3.connect(path, check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._lock = threading.Lock()
        self._collections: dict[str, Collection] = {}

    def __getattr__(self, name: str) -> Collection:
        if name not in self._collections:
            self._collections[name] = Collection(self._conn, self._lock, name)
        return self._collections[name]

    async def command(self, name: str) -> dict:
        # dipakai untuk health check ("ping") -> selalu ok karena file lokal
        return {"ok": 1}

    def close(self) -> None:
        self._conn.close()
