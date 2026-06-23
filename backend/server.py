from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import os
import logging
import secrets
import uuid
import bcrypt
import jwt
from pathlib import Path
from pydantic import BaseModel, Field, EmailStr
from typing import List, Optional, Literal
from datetime import datetime, timezone, timedelta

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

JWT_SECRET = os.environ['JWT_SECRET']
JWT_ALGORITHM = os.environ.get('JWT_ALGORITHM', 'HS256')
TOKEN_EXPIRE_DAYS = int(os.environ.get('ACCESS_TOKEN_EXPIRE_DAYS', '30'))

app = FastAPI()
api_router = APIRouter(prefix="/api")
security = HTTPBearer(auto_error=False)

STAFF_ROLES = {"owner", "admin", "kasir"}


# ----------------------- Helpers -----------------------
def now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def hash_pw(pw: str) -> str:
    return bcrypt.hashpw(pw.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')


def verify_pw(pw: str, hashed: str) -> bool:
    try:
        return bcrypt.checkpw(pw.encode('utf-8'), hashed.encode('utf-8'))
    except Exception:
        return False


def make_token(uid: str) -> str:
    payload = {
        "sub": uid,
        "exp": datetime.now(timezone.utc) + timedelta(days=TOKEN_EXPIRE_DAYS),
    }
    return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)


def clean(doc: dict) -> dict:
    if not doc:
        return doc
    doc.pop("_id", None)
    return doc


async def get_current_user(creds: Optional[HTTPAuthorizationCredentials] = Depends(security)) -> dict:
    if creds is None:
        raise HTTPException(status_code=401, detail="Tidak terautentikasi")
    try:
        payload = jwt.decode(creds.credentials, JWT_SECRET, algorithms=[JWT_ALGORITHM])
        uid = payload.get("sub")
    except jwt.PyJWTError:
        raise HTTPException(status_code=401, detail="Token tidak valid")
    user = await db.users.find_one({"id": uid})
    if not user:
        raise HTTPException(status_code=401, detail="Pengguna tidak ditemukan")
    return clean(user)


def require_roles(*roles):
    async def checker(user: dict = Depends(get_current_user)) -> dict:
        if user["role"] not in roles:
            raise HTTPException(status_code=403, detail="Akses ditolak")
        return user
    return checker


async def require_staff(user: dict = Depends(get_current_user)) -> dict:
    if user["role"] not in STAFF_ROLES:
        raise HTTPException(status_code=403, detail="Khusus staf")
    return user


# ----------------------- Models -----------------------
class RegisterIn(BaseModel):
    email: EmailStr
    password: str = Field(min_length=6, max_length=128)
    nama: str = Field(min_length=1, max_length=80)
    telepon: Optional[str] = ""


class LoginIn(BaseModel):
    email: EmailStr
    password: str


class CustomerIn(BaseModel):
    nama: str
    telepon: Optional[str] = ""
    alamat: Optional[str] = ""


class ServiceIn(BaseModel):
    nama: str
    kategori: str
    satuan: str = "kg"
    harga: int = 0
    estimasi_jam: int = 72
    aktif: bool = True


class OrderItemIn(BaseModel):
    layanan_id: Optional[str] = None
    nama_layanan: str
    tipe: str = "kiloan"
    satuan: str = "kg"
    qty: float = 1
    harga: int = 0


class OrderIn(BaseModel):
    pelanggan_id: Optional[str] = None
    pelanggan_nama: str
    pelanggan_telepon: Optional[str] = ""
    items: List[OrderItemIn]
    diskon: int = 0  # percent
    metode_bayar: str = "Tunai"
    status_bayar: str = "lunas"
    bayar: int = 0
    catatan: Optional[str] = ""


class OrderUpdate(BaseModel):
    status: Optional[str] = None
    status_bayar: Optional[str] = None
    total: Optional[int] = None
    diskon: Optional[int] = None
    catatan: Optional[str] = None
    items: Optional[List[OrderItemIn]] = None


class CustomerOrderIn(BaseModel):
    paket: str
    harga: int = 0
    catatan: Optional[str] = ""


class ClaimIn(BaseModel):
    kode: str


class ExpenseIn(BaseModel):
    tanggal: Optional[str] = None
    kategori: str
    nama: str
    jumlah: float = 1
    satuan: Optional[str] = "pcs"
    harga_satuan: int = 0
    total: int = 0
    status: str = "Sudah Dibayar"
    catatan: Optional[str] = ""


class CashIn(BaseModel):
    tanggal: Optional[str] = None
    jenis: str = "keluar"  # masuk / keluar
    nominal: int = 0
    keterangan: Optional[str] = ""


class RoleUpdate(BaseModel):
    role: str


# ----------------------- Seed -----------------------
SEED_LAYANAN = [
    {"nama": "Cuci Setrika - Reguler 3 Hari", "kategori": "Cuci Setrika", "satuan": "kg", "harga": 7000, "estimasi_jam": 72},
    {"nama": "Cuci Setrika - Reguler 2 Hari", "kategori": "Cuci Setrika", "satuan": "kg", "harga": 8000, "estimasi_jam": 48},
    {"nama": "Cuci Setrika - Reguler 1 Hari", "kategori": "Cuci Setrika", "satuan": "kg", "harga": 10000, "estimasi_jam": 24},
    {"nama": "Cuci Setrika - Express 6 Jam", "kategori": "Cuci Setrika", "satuan": "kg", "harga": 20000, "estimasi_jam": 6},
    {"nama": "Cuci Setrika - Express 3 Jam", "kategori": "Cuci Setrika", "satuan": "kg", "harga": 25000, "estimasi_jam": 3},
    {"nama": "Cuci Lipat - Reguler 3 Hari", "kategori": "Cuci Lipat", "satuan": "kg", "harga": 5000, "estimasi_jam": 72},
    {"nama": "Cuci Lipat - Reguler 2 Hari", "kategori": "Cuci Lipat", "satuan": "kg", "harga": 6000, "estimasi_jam": 48},
    {"nama": "Cuci Lipat - Reguler 1 Hari", "kategori": "Cuci Lipat", "satuan": "kg", "harga": 8000, "estimasi_jam": 24},
    {"nama": "Cuci Lipat - Express 6 Jam", "kategori": "Cuci Lipat", "satuan": "kg", "harga": 10000, "estimasi_jam": 6},
    {"nama": "Setrika Saja - Reguler 3 Hari", "kategori": "Setrika Saja", "satuan": "kg", "harga": 5000, "estimasi_jam": 72},
    {"nama": "Setrika Saja - Reguler 2 Hari", "kategori": "Setrika Saja", "satuan": "kg", "harga": 6000, "estimasi_jam": 48},
    {"nama": "Setrika Saja - Reguler 1 Hari", "kategori": "Setrika Saja", "satuan": "kg", "harga": 8000, "estimasi_jam": 24},
    {"nama": "Setrika Saja - Express 6 Jam", "kategori": "Setrika Saja", "satuan": "kg", "harga": 10000, "estimasi_jam": 6},
    {"nama": "Selimut", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 10000, "estimasi_jam": 72},
    {"nama": "Seprai", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 15000, "estimasi_jam": 72},
    {"nama": "Bed Cover", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 30000, "estimasi_jam": 72},
    {"nama": "Boneka", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 5000, "estimasi_jam": 72},
    {"nama": "Bantal", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 10000, "estimasi_jam": 72},
    {"nama": "Sepatu", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 25000, "estimasi_jam": 72},
    {"nama": "Sandal", "kategori": "Harga Khusus", "satuan": "pcs", "harga": 15000, "estimasi_jam": 72},
]


@api_router.get("/health")
async def health():
    try:
        await db.command("ping")
        return {"status": "ok", "db": "connected"}
    except Exception as e:
        raise HTTPException(status_code=503, detail=f"DB tidak terhubung: {e}")


@app.on_event("startup")
async def seed():
    if await db.layanan.count_documents({}) == 0:
        for s in SEED_LAYANAN:
            await db.layanan.insert_one({
                "id": str(uuid.uuid4()),
                "aktif": True,
                "created_at": now_iso(),
                **s,
            })
        logging.info("Seeded layanan")


# ----------------------- Auth -----------------------
@api_router.post("/auth/register")
async def register(body: RegisterIn):
    existing = await db.users.find_one({"email": body.email.lower()})
    if existing:
        raise HTTPException(status_code=400, detail="Email sudah terdaftar")
    count = await db.users.count_documents({})
    if count == 0:
        role = "owner"
    elif count < 3:
        role = "admin"
    else:
        role = "pelanggan"
    uid = str(uuid.uuid4())
    user = {
        "id": uid,
        "email": body.email.lower(),
        "password": hash_pw(body.password),
        "nama": body.nama,
        "telepon": body.telepon or "",
        "role": role,
        "created_at": now_iso(),
    }
    await db.users.insert_one(user)
    token = make_token(uid)
    return {"token": token, "user": {"id": uid, "email": user["email"], "nama": user["nama"], "role": role, "telepon": user["telepon"]}}


@api_router.post("/auth/login")
async def login(body: LoginIn):
    user = await db.users.find_one({"email": body.email.lower()})
    if not user or not verify_pw(body.password, user["password"]):
        raise HTTPException(status_code=401, detail="Email atau kata sandi salah")
    token = make_token(user["id"])
    return {"token": token, "user": {"id": user["id"], "email": user["email"], "nama": user["nama"], "role": user["role"], "telepon": user.get("telepon", "")}}


@api_router.get("/auth/me")
async def me(user: dict = Depends(get_current_user)):
    return {"id": user["id"], "email": user["email"], "nama": user["nama"], "role": user["role"], "telepon": user.get("telepon", "")}


# ----------------------- Layanan -----------------------
@api_router.get("/services")
async def list_services(user: dict = Depends(get_current_user)):
    rows = await db.layanan.find().sort("kategori", 1).to_list(500)
    return [clean(r) for r in rows]


@api_router.post("/services")
async def create_service(body: ServiceIn, user: dict = Depends(require_roles("owner", "admin"))):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **body.dict()}
    await db.layanan.insert_one(doc)
    return clean(doc)


@api_router.put("/services/{sid}")
async def update_service(sid: str, body: ServiceIn, user: dict = Depends(require_roles("owner", "admin"))):
    await db.layanan.update_one({"id": sid}, {"$set": body.dict()})
    doc = await db.layanan.find_one({"id": sid})
    if not doc:
        raise HTTPException(404, "Layanan tidak ditemukan")
    return clean(doc)


@api_router.delete("/services/{sid}")
async def delete_service(sid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.layanan.delete_one({"id": sid})
    return {"ok": True}


# ----------------------- Pelanggan (customers) -----------------------
@api_router.get("/customers")
async def list_customers(user: dict = Depends(require_staff)):
    rows = await db.pelanggan.find().sort("nama", 1).to_list(1000)
    return [clean(r) for r in rows]


@api_router.post("/customers")
async def create_customer(body: CustomerIn, user: dict = Depends(require_staff)):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **body.dict()}
    await db.pelanggan.insert_one(doc)
    return clean(doc)


@api_router.put("/customers/{cid}")
async def update_customer(cid: str, body: CustomerIn, user: dict = Depends(require_staff)):
    await db.pelanggan.update_one({"id": cid}, {"$set": body.dict()})
    doc = await db.pelanggan.find_one({"id": cid})
    if not doc:
        raise HTTPException(404, "Pelanggan tidak ditemukan")
    return clean(doc)


@api_router.delete("/customers/{cid}")
async def delete_customer(cid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.pelanggan.delete_one({"id": cid})
    return {"ok": True}


# ----------------------- Pesanan (orders) -----------------------
async def gen_invoice() -> str:
    today = datetime.now(timezone.utc)
    prefix = "INV-" + today.strftime("%y%m%d")
    count = await db.pesanan.count_documents({"nomor_invoice": {"$regex": "^" + prefix}})
    return f"{prefix}-{count + 1:04d}"


@api_router.post("/orders")
async def create_order(body: OrderIn, user: dict = Depends(require_staff)):
    if not body.items:
        raise HTTPException(400, "Item kosong")
    # link / create customer
    pelanggan_id = body.pelanggan_id
    if not pelanggan_id and body.pelanggan_nama:
        existing = await db.pelanggan.find_one({"nama": body.pelanggan_nama})
        if existing:
            pelanggan_id = existing["id"]
        else:
            pelanggan_id = str(uuid.uuid4())
            await db.pelanggan.insert_one({
                "id": pelanggan_id, "nama": body.pelanggan_nama,
                "telepon": body.pelanggan_telepon or "", "alamat": "", "created_at": now_iso(),
            })
    items = []
    subtotal = 0
    max_jam = 24
    for it in body.items:
        sub = int(round(it.qty * it.harga))
        subtotal += sub
        items.append({**it.dict(), "subtotal": sub})
        svc = await db.layanan.find_one({"id": it.layanan_id}) if it.layanan_id else None
        if svc:
            max_jam = max(max_jam, svc.get("estimasi_jam", 24))
    diskon_nominal = int(round(subtotal * body.diskon / 100))
    total = subtotal - diskon_nominal
    kembalian = max(0, body.bayar - total) if body.status_bayar == "lunas" else 0
    estimasi = (datetime.now(timezone.utc) + timedelta(hours=max_jam)).isoformat()
    doc = {
        "id": str(uuid.uuid4()),
        "nomor_invoice": await gen_invoice(),
        "kode_tracking": secrets.token_hex(4),
        "pelanggan_id": pelanggan_id,
        "pelanggan_nama": body.pelanggan_nama,
        "pelanggan_telepon": body.pelanggan_telepon or "",
        "kasir_id": user["id"],
        "kasir_nama": user["nama"],
        "items": items,
        "status": "proses",
        "subtotal": subtotal,
        "diskon": body.diskon,
        "diskon_nominal": diskon_nominal,
        "total": total,
        "bayar": body.bayar,
        "kembalian": kembalian,
        "metode_bayar": body.metode_bayar,
        "status_bayar": body.status_bayar,
        "catatan": body.catatan or "",
        "perlu_timbang": False,
        "estimasi_selesai": estimasi,
        "owner_user_id": None,
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.pesanan.insert_one(doc)
    return clean(doc)


@api_router.get("/orders")
async def list_orders(user: dict = Depends(require_staff)):
    rows = await db.pesanan.find().sort("created_at", -1).limit(1000).to_list(1000)
    return [clean(r) for r in rows]


@api_router.get("/orders/mine")
async def my_orders(user: dict = Depends(get_current_user)):
    rows = await db.pesanan.find({"owner_user_id": user["id"]}).sort("created_at", -1).to_list(200)
    return [clean(r) for r in rows]


@api_router.get("/orders/{oid}")
async def get_order(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.pesanan.find_one({"id": oid})
    if not doc:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if user["role"] not in STAFF_ROLES and doc.get("owner_user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    return clean(doc)


@api_router.put("/orders/{oid}")
async def update_order(oid: str, body: OrderUpdate, user: dict = Depends(require_staff)):
    doc = await db.pesanan.find_one({"id": oid})
    if not doc:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    upd = {"updated_at": now_iso()}
    if body.status is not None:
        upd["status"] = body.status
    if body.status_bayar is not None:
        upd["status_bayar"] = body.status_bayar
    if body.catatan is not None:
        upd["catatan"] = body.catatan
    if body.items is not None:
        items = []
        subtotal = 0
        for it in body.items:
            sub = int(round(it.qty * it.harga))
            subtotal += sub
            items.append({**it.dict(), "subtotal": sub})
        upd["items"] = items
        upd["subtotal"] = subtotal
        diskon = body.diskon if body.diskon is not None else doc.get("diskon", 0)
        upd["diskon"] = diskon
        upd["diskon_nominal"] = int(round(subtotal * diskon / 100))
        upd["total"] = subtotal - upd["diskon_nominal"]
        upd["perlu_timbang"] = False
    elif body.total is not None:
        upd["total"] = body.total
    if body.diskon is not None and body.items is None:
        upd["diskon"] = body.diskon
    # audit
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "pesanan_id": oid, "user": user["nama"],
        "perubahan": {k: v for k, v in upd.items() if k != "updated_at"},
        "created_at": now_iso(),
    })
    await db.pesanan.update_one({"id": oid}, {"$set": upd})
    doc = await db.pesanan.find_one({"id": oid})
    return clean(doc)


@api_router.delete("/orders/{oid}")
async def delete_order(oid: str, user: dict = Depends(require_roles("owner"))):
    await db.pesanan.delete_one({"id": oid})
    await db.audit_log.insert_one({
        "id": str(uuid.uuid4()), "pesanan_id": oid, "user": user["nama"],
        "perubahan": {"action": "delete"}, "created_at": now_iso(),
    })
    return {"ok": True}


# ----------------------- Customer portal RPC -----------------------
@api_router.post("/orders/customer")
async def pesan_pelanggan(body: CustomerOrderIn, user: dict = Depends(get_current_user)):
    doc = {
        "id": str(uuid.uuid4()),
        "nomor_invoice": await gen_invoice(),
        "kode_tracking": secrets.token_hex(4),
        "pelanggan_id": None,
        "pelanggan_nama": user["nama"],
        "pelanggan_telepon": user.get("telepon", ""),
        "kasir_id": None,
        "kasir_nama": "Online",
        "items": [{"nama_layanan": body.paket, "tipe": "kiloan", "satuan": "kg", "qty": 0, "harga": body.harga, "subtotal": 0}],
        "status": "proses",
        "subtotal": 0,
        "diskon": 0,
        "diskon_nominal": 0,
        "total": 0,
        "bayar": 0,
        "kembalian": 0,
        "metode_bayar": "-",
        "status_bayar": "belum",
        "catatan": body.catatan or "",
        "perlu_timbang": True,
        "estimasi_selesai": None,
        "owner_user_id": user["id"],
        "created_at": now_iso(),
        "updated_at": now_iso(),
    }
    await db.pesanan.insert_one(doc)
    return {"nomor_invoice": doc["nomor_invoice"]}


@api_router.post("/orders/claim")
async def klaim_pesanan(body: ClaimIn, user: dict = Depends(get_current_user)):
    doc = await db.pesanan.find_one({"kode_tracking": body.kode.strip().lower()})
    if not doc:
        raise HTTPException(404, "Kode nota tidak ditemukan")
    await db.pesanan.update_one({"id": doc["id"]}, {"$set": {"owner_user_id": user["id"]}})
    return {"nomor_invoice": doc["nomor_invoice"]}


@api_router.post("/orders/{oid}/cancel")
async def batal_pesanan(oid: str, user: dict = Depends(get_current_user)):
    doc = await db.pesanan.find_one({"id": oid})
    if not doc:
        raise HTTPException(404, "Pesanan tidak ditemukan")
    if user["role"] not in STAFF_ROLES and doc.get("owner_user_id") != user["id"]:
        raise HTTPException(403, "Akses ditolak")
    if not doc.get("perlu_timbang") and user["role"] not in STAFF_ROLES:
        raise HTTPException(400, "Hanya bisa batal saat menunggu ditimbang")
    await db.pesanan.update_one({"id": oid}, {"$set": {"status": "batal", "updated_at": now_iso()}})
    return {"ok": True}


# ----------------------- Pengeluaran (expenses) -----------------------
@api_router.get("/expenses")
async def list_expenses(user: dict = Depends(require_staff)):
    rows = await db.pengeluaran.find().sort("tanggal", -1).to_list(1000)
    return [clean(r) for r in rows]


@api_router.post("/expenses")
async def create_expense(body: ExpenseIn, user: dict = Depends(require_staff)):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **body.dict()}
    if not doc.get("tanggal"):
        doc["tanggal"] = now_iso()
    await db.pengeluaran.insert_one(doc)
    return clean(doc)


@api_router.put("/expenses/{eid}")
async def update_expense(eid: str, body: ExpenseIn, user: dict = Depends(require_staff)):
    await db.pengeluaran.update_one({"id": eid}, {"$set": body.dict()})
    doc = await db.pengeluaran.find_one({"id": eid})
    if not doc:
        raise HTTPException(404, "Tidak ditemukan")
    return clean(doc)


@api_router.delete("/expenses/{eid}")
async def delete_expense(eid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.pengeluaran.delete_one({"id": eid})
    return {"ok": True}


# ----------------------- Kas (cash book) -----------------------
@api_router.get("/cash")
async def list_cash(user: dict = Depends(require_staff)):
    rows = await db.kas.find().sort("tanggal", -1).to_list(1000)
    return [clean(r) for r in rows]


@api_router.post("/cash")
async def create_cash(body: CashIn, user: dict = Depends(require_staff)):
    doc = {"id": str(uuid.uuid4()), "created_at": now_iso(), **body.dict()}
    if not doc.get("tanggal"):
        doc["tanggal"] = now_iso()
    await db.kas.insert_one(doc)
    return clean(doc)


@api_router.delete("/cash/{kid}")
async def delete_cash(kid: str, user: dict = Depends(require_roles("owner", "admin"))):
    await db.kas.delete_one({"id": kid})
    return {"ok": True}


# ----------------------- Dashboard & Reports -----------------------
def _dt(iso):
    try:
        return datetime.fromisoformat(iso).astimezone(timezone.utc)
    except Exception:
        return None


@api_router.get("/dashboard")
async def dashboard(user: dict = Depends(require_staff)):
    orders = await db.pesanan.find().to_list(5000)
    valid = [o for o in orders if o.get("status") != "batal"]
    now = datetime.now(timezone.utc)

    def sum_if(pred):
        return sum(int(o.get("total", 0)) for o in valid if pred(_dt(o.get("created_at"))))

    omzet_hari = sum_if(lambda d: d and d.date() == now.date())
    omzet_bulan = sum_if(lambda d: d and d.year == now.year and d.month == now.month)
    omzet_tahun = sum_if(lambda d: d and d.year == now.year)
    order_hari = len([o for o in valid if (_dt(o.get("created_at")) and _dt(o["created_at"]).date() == now.date())])
    belum_bayar = sum(int(o.get("total", 0)) for o in valid if o.get("status_bayar") != "lunas")

    # top customers
    from collections import defaultdict
    spend = defaultdict(int)
    for o in valid:
        spend[o.get("pelanggan_nama", "-")] += int(o.get("total", 0))
    top = sorted(spend.items(), key=lambda x: -x[1])[:5]

    recent = sorted(orders, key=lambda o: o.get("created_at", ""), reverse=True)[:8]
    return {
        "omzet_hari": omzet_hari,
        "omzet_bulan": omzet_bulan,
        "omzet_tahun": omzet_tahun,
        "order_hari": order_hari,
        "total_order": len(valid),
        "belum_bayar": belum_bayar,
        "top_customers": [{"nama": n, "total": t} for n, t in top],
        "recent": [clean(o) for o in recent],
    }


@api_router.get("/reports")
async def reports(dari: str, sampai: str, user: dict = Depends(require_roles("owner", "admin"))):
    start = _dt(dari) or datetime.now(timezone.utc)
    end = _dt(sampai) or datetime.now(timezone.utc)
    end = end.replace(hour=23, minute=59, second=59)
    orders = await db.pesanan.find().to_list(5000)
    expenses = await db.pengeluaran.find().to_list(5000)
    cash = await db.kas.find().to_list(5000)

    def in_range(iso):
        d = _dt(iso)
        return d and start.date() <= d.date() <= end.date()

    valid = [o for o in orders if o.get("status") != "batal" and in_range(o.get("created_at"))]
    omzet = sum(int(o.get("total", 0)) for o in valid)
    belum = sum(int(o.get("total", 0)) for o in valid if o.get("status_bayar") != "lunas")
    exp_total = sum(int(e.get("total", 0)) for e in expenses if in_range(e.get("tanggal")) and e.get("status") != "Dibatalkan")
    kas_keluar = sum(int(c.get("nominal", 0)) for c in cash if c.get("jenis") == "keluar" and in_range(c.get("tanggal")))
    pengeluaran_total = exp_total + kas_keluar
    laba = omzet - pengeluaran_total

    # daily breakdown
    from collections import defaultdict
    daily = defaultdict(lambda: {"omzet": 0, "pengeluaran": 0})
    for o in valid:
        d = _dt(o["created_at"]).date().isoformat()
        daily[d]["omzet"] += int(o.get("total", 0))
    for e in expenses:
        if in_range(e.get("tanggal")) and e.get("status") != "Dibatalkan":
            d = _dt(e["tanggal"]).date().isoformat()
            daily[d]["pengeluaran"] += int(e.get("total", 0))
    breakdown = [{"tanggal": k, "omzet": v["omzet"], "pengeluaran": v["pengeluaran"], "laba": v["omzet"] - v["pengeluaran"]}
                 for k, v in sorted(daily.items())]
    return {
        "omzet": omzet, "pengeluaran": pengeluaran_total, "laba": laba,
        "kas_keluar": kas_keluar, "belum_bayar": belum, "breakdown": breakdown,
    }


# ----------------------- Users -----------------------
@api_router.get("/users")
async def list_users(user: dict = Depends(require_roles("owner", "admin"))):
    rows = await db.users.find().sort("created_at", 1).to_list(500)
    return [{"id": r["id"], "email": r["email"], "nama": r["nama"], "role": r["role"], "telepon": r.get("telepon", "")} for r in rows]


@api_router.put("/users/{uid}/role")
async def set_role(uid: str, body: RoleUpdate, user: dict = Depends(require_roles("owner"))):
    if body.role not in {"owner", "admin", "kasir", "pelanggan"}:
        raise HTTPException(400, "Peran tidak valid")
    await db.users.update_one({"id": uid}, {"$set": {"role": body.role}})
    return {"ok": True}


app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Global error handler — never leak stack traces to clients in production.
from fastapi.responses import JSONResponse
from fastapi import Request


@app.exception_handler(Exception)
async def unhandled_exception_handler(request: Request, exc: Exception):
    logger.exception("Unhandled error on %s %s", request.method, request.url.path)
    return JSONResponse(status_code=500, content={"detail": "Terjadi kesalahan server. Coba lagi."})


@app.on_event("shutdown")
async def shutdown_db_client():
    client.close()
