# HANUM Laundry — PRD

## Original Problem Statement
Build a ready-to-use laundry cashier (kasir laundry) POS app, replicating the user's provided Flutter starter + web `index.html` (HANUM Laundry). Must be downloadable as an APK and connect to a Bluetooth thermal receipt printer. Built in React Native (Expo) per user agreement (platform does not support Flutter).

## Architecture
- **Frontend:** Expo SDK 54 + expo-router (file-based). Custom design system (Plus Jakarta Sans + Space Mono fonts), indigo #6366F1 brand, teal #245D56 splash. JWT auth context. Bottom tabs for staff, stack routes for sub-screens & customer portal.
- **Backend:** FastAPI + MongoDB (motor). uuid string IDs, integer rupiah money, ISO datetimes. JWT (pyjwt) + bcrypt. All routes under `/api`.
- **Printing:** Pure-JS ESC/POS 58mm builder + `react-native-bluetooth-classic` (guarded; native-build only) + expo-print PDF/share fallback (works everywhere).

## User Personas
- **Owner:** full access; only role that deletes orders/finances & manages user roles.
- **Admin:** operations + reports/profit; cannot delete finances.
- **Kasir:** POS, orders, customers, expenses, cash; no reports/users/delete.
- **Pelanggan:** customer portal only (own claimed/placed orders).

## Core Requirements (static)
- Auto role assignment: 1st=owner, 2nd/3rd=admin, 4th+=pelanggan.
- POS with kiloan (per kg) & satuan (per pcs) services, discount %, payment method/status, receipt.
- Order lifecycle: proses → siap → selesai, plus batal (excluded from omzet/laba).
- Customer portal: Laundry Saya, Klaim Nota (kode_tracking), Pesan Laundry, cancel pending.
- Expenses, cash book, date-range reports, customer & service management, user role management.

## Implemented (2026-06-23)
- ✅ Backend: auth, services (20 seeded), customers, orders (POS + portal RPC), expenses, cash, dashboard, reports, users + role enforcement. 26/26 backend tests pass.
- ✅ Frontend: login/register, staff tabs (Dashboard/POS/Pesanan/Pelanggan/Lainnya), POS cart + checkout, orders list w/ filters + detail action sheet, customers CRUD, expenses, cash, reports, users, services management, customer portal, thermal receipt preview + Bluetooth/PDF print.
- ✅ Android Bluetooth permissions + iOS usage strings in app.json.

## Backlog / Remaining
- **P1:** Real Bluetooth printing validation (requires native APK build — cannot test in preview/Expo Go).
- **P2:** Defer invoice numbering for customer perlu_timbang orders to avoid gaps on cancel.
- **P2:** Expense categories management (custom categories), "catat cepat dari kertas" bulk entry.
- **P2:** WhatsApp notification to customer (telepon stored).
- **P3:** Dark mode, aggregation via server-side SUM for scale, audit log viewer UI.

## Next Tasks
- Have user deploy (Publish) → generate APK → test Bluetooth thermal printing on a real 58mm ESC/POS printer.
