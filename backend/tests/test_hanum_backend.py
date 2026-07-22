"""HANUM Laundry backend regression tests.

Covers: auth, services, customers, orders POS, customer portal RPC,
expenses, cash, dashboard, reports, users, role enforcement.
"""
import os
import uuid
import time
import pytest
import requests

# Backend URL is exposed to the frontend as EXPO_PUBLIC_BACKEND_URL.
BASE_URL = (
    os.environ.get("EXPO_BACKEND_URL")
    or os.environ.get("EXPO_PUBLIC_BACKEND_URL")
    or "https://laundry-checkout-app.preview.emergentagent.com"
).rstrip("/")
API = f"{BASE_URL}/api"

OWNER_EMAIL = "owner@hanum.id"
OWNER_PASSWORD = "owner123"

UNIQ = uuid.uuid4().hex[:8]


# ----------------------- Fixtures -----------------------
@pytest.fixture(scope="session")
def s():
    sess = requests.Session()
    sess.headers.update({"Content-Type": "application/json"})
    return sess


def _auth(token):
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture(scope="session")
def owner_token(s):
    r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
    assert r.status_code == 200, f"Owner login failed: {r.status_code} {r.text}"
    return r.json()["token"]


@pytest.fixture(scope="session")
def kasir_user(s, owner_token):
    """Register a new account (will be pelanggan by registration order if >=4),
    then have owner promote it to 'kasir' so we can test staff/role enforcement."""
    email = f"kasir_{UNIQ}@test.id"
    password = "kasir123"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "nama": f"Kasir {UNIQ}", "telepon": "0811"})
    assert r.status_code == 200, r.text
    data = r.json()
    uid = data["user"]["id"]
    # Promote to kasir via owner.
    r2 = s.put(f"{API}/users/{uid}/role", json={"role": "kasir"}, headers=_auth(owner_token))
    assert r2.status_code == 200, r2.text
    # Re-login to get fresh role-aware token (token only stores sub; role resolved on me)
    rl = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"email": email, "password": password, "id": uid, "token": rl.json()["token"]}


@pytest.fixture(scope="session")
def pelanggan_user(s, owner_token):
    email = f"pel_{UNIQ}@test.id"
    password = "pelanggan123"
    r = s.post(f"{API}/auth/register", json={"email": email, "password": password, "nama": f"Pel {UNIQ}", "telepon": "0822"})
    assert r.status_code == 200, r.text
    uid = r.json()["user"]["id"]
    # Force role to pelanggan in case account order made them admin.
    s.put(f"{API}/users/{uid}/role", json={"role": "pelanggan"}, headers=_auth(owner_token))
    rl = s.post(f"{API}/auth/login", json={"email": email, "password": password})
    return {"email": email, "password": password, "id": uid, "token": rl.json()["token"]}


# ----------------------- Auth -----------------------
class TestAuth:
    def test_login_owner(self, s):
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": OWNER_PASSWORD})
        assert r.status_code == 200
        j = r.json()
        assert "token" in j and j["user"]["role"] == "owner"

    def test_login_bad_password(self, s):
        r = s.post(f"{API}/auth/login", json={"email": OWNER_EMAIL, "password": "wrong"})
        assert r.status_code == 401

    def test_me(self, s, owner_token):
        r = s.get(f"{API}/auth/me", headers=_auth(owner_token))
        assert r.status_code == 200
        assert r.json()["email"] == OWNER_EMAIL

    def test_me_no_token(self, s):
        r = s.get(f"{API}/auth/me")
        assert r.status_code == 401

    def test_register_duplicate(self, s):
        r = s.post(f"{API}/auth/register", json={"email": OWNER_EMAIL, "password": "x", "nama": "x"})
        assert r.status_code == 400


# ----------------------- Services -----------------------
class TestServices:
    def test_list_services_seeded(self, s, owner_token):
        r = s.get(f"{API}/services", headers=_auth(owner_token))
        assert r.status_code == 200
        rows = r.json()
        assert len(rows) >= 20, f"Expected >=20 seeded services, got {len(rows)}"
        assert all("_id" not in row for row in rows)
        assert "harga" in rows[0]

    def test_service_crud(self, s, owner_token):
        body = {"nama": f"TEST_SVC_{UNIQ}", "kategori": "TEST", "satuan": "kg", "harga": 9000, "estimasi_jam": 24}
        r = s.post(f"{API}/services", json=body, headers=_auth(owner_token))
        assert r.status_code == 200
        sid = r.json()["id"]
        # update
        body["harga"] = 11000
        r2 = s.put(f"{API}/services/{sid}", json=body, headers=_auth(owner_token))
        assert r2.status_code == 200 and r2.json()["harga"] == 11000
        # delete
        r3 = s.delete(f"{API}/services/{sid}", headers=_auth(owner_token))
        assert r3.status_code == 200


# ----------------------- Customers -----------------------
class TestCustomers:
    def test_customer_crud(self, s, owner_token):
        body = {"nama": f"TEST_CUST_{UNIQ}", "telepon": "081234", "alamat": "Jl"}
        r = s.post(f"{API}/customers", json=body, headers=_auth(owner_token))
        assert r.status_code == 200
        cid = r.json()["id"]
        # list
        rl = s.get(f"{API}/customers", headers=_auth(owner_token))
        assert rl.status_code == 200 and any(c["id"] == cid for c in rl.json())
        # update
        body["alamat"] = "Jl Baru"
        r2 = s.put(f"{API}/customers/{cid}", json=body, headers=_auth(owner_token))
        assert r2.status_code == 200 and r2.json()["alamat"] == "Jl Baru"
        # delete
        r3 = s.delete(f"{API}/customers/{cid}", headers=_auth(owner_token))
        assert r3.status_code == 200


# ----------------------- Orders POS -----------------------
class TestOrdersPOS:
    @pytest.fixture(scope="class")
    def created_order(self, s, owner_token):
        body = {
            "pelanggan_nama": f"TEST_ORD_{UNIQ}",
            "pelanggan_telepon": "081111",
            "items": [
                {"nama_layanan": "Cuci Setrika", "tipe": "kiloan", "satuan": "kg", "qty": 3, "harga": 7000},
                {"nama_layanan": "Setrika", "tipe": "kiloan", "satuan": "kg", "qty": 2, "harga": 5000},
            ],
            "diskon": 10,
            "metode_bayar": "Tunai",
            "status_bayar": "lunas",
            "bayar": 30000,
        }
        r = s.post(f"{API}/orders", json=body, headers=_auth(owner_token))
        assert r.status_code == 200, r.text
        return r.json()

    def test_order_totals_and_invoice(self, created_order):
        o = created_order
        # 3*7000 + 2*5000 = 21000 + 10000 = 31000; diskon 10% => 3100; total=27900
        assert o["subtotal"] == 31000
        assert o["diskon_nominal"] == 3100
        assert o["total"] == 27900
        assert o["nomor_invoice"].startswith("INV-")
        # INV-YYMMDD-####
        parts = o["nomor_invoice"].split("-")
        assert len(parts) == 3 and len(parts[1]) == 6 and len(parts[2]) == 4
        assert len(o["kode_tracking"]) >= 6

    def test_order_get_and_list(self, s, owner_token, created_order):
        r = s.get(f"{API}/orders/{created_order['id']}", headers=_auth(owner_token))
        assert r.status_code == 200 and r.json()["id"] == created_order["id"]
        r2 = s.get(f"{API}/orders", headers=_auth(owner_token))
        assert r2.status_code == 200 and any(o["id"] == created_order["id"] for o in r2.json())

    def test_order_update_status_and_items(self, s, owner_token, created_order):
        oid = created_order["id"]
        # mark selesai
        r = s.put(f"{API}/orders/{oid}", json={"status": "selesai"}, headers=_auth(owner_token))
        assert r.status_code == 200 and r.json()["status"] == "selesai"
        # re-weigh items
        new_items = [{"nama_layanan": "Cuci Setrika", "tipe": "kiloan", "satuan": "kg", "qty": 4, "harga": 7000}]
        r2 = s.put(f"{API}/orders/{oid}", json={"items": new_items, "diskon": 0}, headers=_auth(owner_token))
        assert r2.status_code == 200
        j = r2.json()
        assert j["subtotal"] == 28000 and j["total"] == 28000 and j["diskon"] == 0

    def test_order_delete_kasir_forbidden(self, s, kasir_user, created_order):
        r = s.delete(f"{API}/orders/{created_order['id']}", headers=_auth(kasir_user["token"]))
        assert r.status_code == 403

    def test_order_delete_owner(self, s, owner_token):
        # Create separate order to delete
        body = {"pelanggan_nama": "TEST_DEL", "items": [{"nama_layanan": "X", "qty": 1, "harga": 1000}]}
        r = s.post(f"{API}/orders", json=body, headers=_auth(owner_token))
        oid = r.json()["id"]
        rd = s.delete(f"{API}/orders/{oid}", headers=_auth(owner_token))
        assert rd.status_code == 200
        rg = s.get(f"{API}/orders/{oid}", headers=_auth(owner_token))
        assert rg.status_code == 404


# ----------------------- Customer portal RPC -----------------------
class TestPortalRPC:
    def test_customer_creates_order_and_mine(self, s, pelanggan_user):
        r = s.post(f"{API}/orders/customer", json={"paket": "Cuci Kilat", "harga": 10000, "catatan": "pickup"}, headers=_auth(pelanggan_user["token"]))
        assert r.status_code == 200 and r.json()["nomor_invoice"].startswith("INV-")
        rm = s.get(f"{API}/orders/mine", headers=_auth(pelanggan_user["token"]))
        assert rm.status_code == 200 and len(rm.json()) >= 1
        # Must be perlu_timbang
        assert any(o.get("perlu_timbang") for o in rm.json())

    def test_pelanggan_cannot_list_orders(self, s, pelanggan_user):
        r = s.get(f"{API}/orders", headers=_auth(pelanggan_user["token"]))
        assert r.status_code == 403

    def test_claim_order(self, s, owner_token, pelanggan_user):
        # Owner creates an order, capture kode_tracking, then customer claims
        body = {"pelanggan_nama": "WALKIN", "items": [{"nama_layanan": "X", "qty": 1, "harga": 5000}]}
        r = s.post(f"{API}/orders", json=body, headers=_auth(owner_token))
        kode = r.json()["kode_tracking"]
        rc = s.post(f"{API}/orders/claim", json={"kode": kode}, headers=_auth(pelanggan_user["token"]))
        assert rc.status_code == 200
        # Now pelanggan can fetch it
        rg = s.get(f"{API}/orders/{r.json()['id']}", headers=_auth(pelanggan_user["token"]))
        assert rg.status_code == 200

    def test_cancel_perlu_timbang(self, s, pelanggan_user):
        r = s.post(f"{API}/orders/customer", json={"paket": "Test cancel", "harga": 0}, headers=_auth(pelanggan_user["token"]))
        assert r.status_code == 200
        # find that order
        rm = s.get(f"{API}/orders/mine", headers=_auth(pelanggan_user["token"]))
        cand = [o for o in rm.json() if o.get("perlu_timbang") and o.get("status") != "batal"]
        assert cand, "no perlu_timbang order found"
        oid = cand[0]["id"]
        rc = s.post(f"{API}/orders/{oid}/cancel", headers=_auth(pelanggan_user["token"]))
        assert rc.status_code == 200


# ----------------------- Expenses & Cash -----------------------
class TestExpensesCash:
    def test_expense_flow(self, s, owner_token):
        body = {"kategori": "Operasional", "nama": "TEST_DETERGEN", "jumlah": 1, "harga_satuan": 50000, "total": 50000}
        r = s.post(f"{API}/expenses", json=body, headers=_auth(owner_token))
        assert r.status_code == 200
        eid = r.json()["id"]
        rl = s.get(f"{API}/expenses", headers=_auth(owner_token))
        assert rl.status_code == 200 and any(e["id"] == eid for e in rl.json())
        # update
        body["total"] = 60000
        r2 = s.put(f"{API}/expenses/{eid}", json=body, headers=_auth(owner_token))
        assert r2.status_code == 200 and r2.json()["total"] == 60000
        # delete
        rd = s.delete(f"{API}/expenses/{eid}", headers=_auth(owner_token))
        assert rd.status_code == 200

    def test_cash_flow(self, s, owner_token):
        body = {"jenis": "keluar", "nominal": 25000, "keterangan": "TEST"}
        r = s.post(f"{API}/cash", json=body, headers=_auth(owner_token))
        assert r.status_code == 200
        kid = r.json()["id"]
        rl = s.get(f"{API}/cash", headers=_auth(owner_token))
        assert rl.status_code == 200 and any(c["id"] == kid for c in rl.json())
        rd = s.delete(f"{API}/cash/{kid}", headers=_auth(owner_token))
        assert rd.status_code == 200


# ----------------------- Dashboard & Reports -----------------------
class TestDashboardReports:
    def test_dashboard_keys(self, s, owner_token):
        r = s.get(f"{API}/dashboard", headers=_auth(owner_token))
        assert r.status_code == 200
        for k in ["omzet_hari", "omzet_bulan", "omzet_tahun", "order_hari", "total_order", "belum_bayar", "top_customers", "recent"]:
            assert k in r.json()

    def test_reports_owner(self, s, owner_token):
        from datetime import datetime, timezone, timedelta
        today = datetime.now(timezone.utc).date().isoformat()
        yest = (datetime.now(timezone.utc) - timedelta(days=7)).date().isoformat()
        r = s.get(f"{API}/reports", params={"dari": yest, "sampai": today}, headers=_auth(owner_token))
        assert r.status_code == 200
        for k in ["omzet", "pengeluaran", "laba", "kas_keluar", "belum_bayar", "breakdown"]:
            assert k in r.json()

    def test_reports_kasir_forbidden(self, s, kasir_user):
        r = s.get(f"{API}/reports?dari=2026-01-01&sampai=2026-12-31", headers=_auth(kasir_user["token"]))
        assert r.status_code == 403


# ----------------------- Users / Role enforcement -----------------------
class TestUsersRoles:
    def test_users_list_owner(self, s, owner_token):
        r = s.get(f"{API}/users", headers=_auth(owner_token))
        assert r.status_code == 200 and any(u["email"] == OWNER_EMAIL for u in r.json())

    def test_users_list_kasir_forbidden(self, s, kasir_user):
        r = s.get(f"{API}/users", headers=_auth(kasir_user["token"]))
        assert r.status_code == 403

    def test_kasir_cannot_change_role(self, s, kasir_user):
        r = s.put(f"{API}/users/{kasir_user['id']}/role", json={"role": "owner"}, headers=_auth(kasir_user["token"]))
        assert r.status_code == 403

    def test_pelanggan_cannot_create_customer(self, s, pelanggan_user):
        r = s.post(f"{API}/customers", json={"nama": "X"}, headers=_auth(pelanggan_user["token"]))
        assert r.status_code == 403
