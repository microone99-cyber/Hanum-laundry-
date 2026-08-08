import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, StatusPill, EmptyState, Chip, Pill } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

type CartItem = { layanan_id: string; nama: string; harga: number; satuan: string; qty: number };

export default function Portal() {
  const { user, loading: authLoading, logout, isStaff } = useAuth();
  const [list, setList] = useState<any[]>([]);
  const [services, setServices] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [claimSheet, setClaimSheet] = useState(false);
  const [orderSheet, setOrderSheet] = useState(false);
  const [kode, setKode] = useState("");
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);
  const [butuhJemput, setButuhJemput] = useState(false);
  const [alamatJemput, setAlamatJemput] = useState("");
  const [butuhAntar, setButuhAntar] = useState(false);
  const [alamatAntar, setAlamatAntar] = useState("");
  const [antarJemputEnabled, setAntarJemputEnabled] = useState(true);
  const [cat, setCat] = useState<string>("");
  const [pcsQty, setPcsQty] = useState<Record<string, number>>({});
  // Keranjang beneran — dulu tiap tap layanan langsung bikin 1 pesanan terpisah,
  // sekarang dikumpulin dulu di sini dan dikirim jadi 1 pesanan/invoice gabungan.
  const [cart, setCart] = useState<CartItem[]>([]);

  const load = useCallback(async () => {
    try {
      const [mine, svc, settings] = await Promise.all([api.get("/orders/mine"), api.get("/services"), api.get("/settings/public")]);
      setList(mine);
      const active = svc.filter((s: any) => s.aktif);
      setServices(active);
      if (!cat && active.length) setCat(active[0].kategori);
      setAntarJemputEnabled(!!settings.antar_jemput_enabled);
    } finally { setLoading(false); }
  }, [cat]);
  useFocusEffect(useCallback(() => { if (user && !isStaff) load(); }, [load, user, isStaff]));

  if (authLoading) return null;
  if (!user) return <Redirect href="/login" />;
  if (isStaff) return <Redirect href="/(staff)/dashboard" />;

  const claim = async () => {
    if (!kode.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/orders/claim", { kode: kode.trim() });
      setMsg(`✓ Berhasil klaim: ${r.nomor_invoice}`);
      setKode(""); load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const addToCart = (s: any, qty: number = 1) => {
    setCart((c) => {
      const idx = c.findIndex((i) => i.layanan_id === s.id);
      if (idx >= 0) {
        const next = [...c];
        next[idx] = { ...next[idx], qty: s.satuan === "pcs" ? qty : next[idx].qty + 1 };
        return next;
      }
      return [...c, { layanan_id: s.id, nama: s.nama, harga: s.harga, satuan: s.satuan, qty: s.satuan === "pcs" ? qty : 1 }];
    });
  };
  const removeFromCart = (id: string) => setCart((c) => c.filter((i) => i.layanan_id !== id));
  const cartHasItem = (id: string) => cart.some((i) => i.layanan_id === id);

  const cartTotal = cart.reduce((a, i) => a + (i.satuan === "pcs" ? i.qty * i.harga : 0), 0);
  const cartAdaKiloan = cart.some((i) => i.satuan !== "pcs");

  const kirimPesanan = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      await api.post("/orders/customer", {
        items: cart.map((i) => ({ paket: i.nama, harga: i.harga, satuan: i.satuan, qty: i.qty })),
        butuh_jemput: butuhJemput, alamat_jemput: butuhJemput ? alamatJemput : "",
        butuh_antar: butuhAntar, alamat_antar: butuhAntar ? alamatAntar : "",
      });
      setOrderSheet(false);
      setCart([]); setPcsQty({});
      setButuhJemput(false); setAlamatJemput("");
      setButuhAntar(false); setAlamatAntar("");
      load();
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => { await api.post(`/orders/${id}/cancel`); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Laundry Saya" subtitle={user.nama}
        right={<Pressable onPress={logout} hitSlop={8} testID="portal-logout"><Ionicons name="log-out-outline" size={24} color={C.danger} /></Pressable>} />
      <View style={{ flexDirection: "row", gap: SP.sm, padding: SP.lg, paddingBottom: SP.sm }}>
        <Button title="Klaim Nota" variant="outline" icon="ticket-outline" onPress={() => { setMsg(""); setClaimSheet(true); }} style={{ flex: 1 }} testID="open-claim" />
        <Button title="Pesan Laundry" icon="add" onPress={() => setOrderSheet(true)} style={{ flex: 1 }} testID="open-pesan" />
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <FlatList data={list} keyExtractor={(o) => o.id}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="shirt-outline" title="Belum ada pesanan" subtitle="Klaim nota dari struk atau buat pesanan baru." />}
          renderItem={({ item }) => {
            const bisaBatal = item.perlu_timbang && item.status !== "batal" && item.status !== "selesai";
            return (
              <Card testID={`portal-order-${item.id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText weight="bold" style={{ fontFamily: F.mono, fontSize: 14 }}>{item.nomor_invoice}</AppText>
                  <StatusPill status={item.status} />
                </View>
                <AppText style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>Lacak: {item.kode_tracking} · {tglID(item.created_at)}</AppText>
                {(item.butuh_jemput || item.butuh_antar) && (
                  <View style={{ flexDirection: "row", gap: SP.xs, marginTop: SP.xs, flexWrap: "wrap" }}>
                    {item.butuh_jemput && <Pill text="🛵 Minta dijemput" fg={C.brand} bg="#EEF2FF" />}
                    {item.butuh_antar && <Pill text="📦 Minta diantar" fg={C.brand} bg="#EEF2FF" />}
                  </View>
                )}
                <View style={{ marginTop: SP.sm, gap: 2 }}>
                  {(item.items || []).map((it: any, idx: number) => (
                    <AppText key={idx} style={{ color: C.muted, fontSize: 12 }}>
                      • {it.nama_layanan} ({it.satuan === "pcs" ? `${it.qty} pcs` : (it.qty ? `${it.qty} kg` : "menunggu ditimbang")})
                    </AppText>
                  ))}
                </View>
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SP.sm }}>
                  <AppText weight="semibold">{item.perlu_timbang ? "Menunggu ditimbang" : rupiah(item.total)}</AppText>
                  <AppText weight="semibold" style={{ color: item.status_bayar === "lunas" ? C.success : C.danger }}>{item.status_bayar === "lunas" ? "Lunas" : "Belum bayar"}</AppText>
                </View>
                {bisaBatal && <Button title="Batalkan Pesanan" variant="outline" icon="close" onPress={() => cancel(item.id)} style={{ marginTop: SP.md, borderColor: C.danger }} testID={`portal-cancel-${item.id}`} />}
              </Card>
            );
          }} />
      )}

      <Sheet visible={claimSheet} onClose={() => setClaimSheet(false)} title="Klaim Pesanan" testID="claim-sheet">
        <View style={{ gap: SP.md }}>
          <AppText style={{ color: C.muted }}>Masukkan kode nota (tercetak di struk laundry Anda).</AppText>
          <Field label="Kode nota" autoCapitalize="none" value={kode} onChangeText={setKode} testID="claim-kode" />
          {msg ? <AppText style={{ color: msg.startsWith("✓") ? C.success : C.danger }} testID="claim-msg">{msg}</AppText> : null}
          <Button title="Klaim" onPress={claim} loading={busy} testID="claim-submit" />
        </View>
      </Sheet>

      <Sheet visible={orderSheet} onClose={() => setOrderSheet(false)} title="Pesan Laundry" testID="pesan-sheet">
        <View style={{ gap: SP.sm }}>
          {antarJemputEnabled && (
            <>
              <AppText weight="semibold">Antar jemput?</AppText>
              <View style={{ flexDirection: "row", gap: SP.sm }}>
                <Chip label="🛵 Minta Dijemput" active={butuhJemput} onPress={() => setButuhJemput((v) => !v)} testID="toggle-jemput" />
                <Chip label="📦 Minta Diantar" active={butuhAntar} onPress={() => setButuhAntar((v) => !v)} testID="toggle-antar" />
              </View>
              {butuhJemput && (
                <Field label="Alamat jemput" placeholder="Alamat lengkap untuk dijemput" value={alamatJemput} onChangeText={setAlamatJemput} testID="alamat-jemput-input" />
              )}
              {butuhAntar && (
                <Field label="Alamat antar" placeholder="Alamat lengkap untuk diantar" value={alamatAntar} onChangeText={setAlamatAntar} testID="alamat-antar-input" />
              )}
            </>
          )}
          <AppText style={{ color: C.muted, marginTop: SP.xs }}>
            Geser kategori di bawah untuk lihat paket lainnya. Cucian kiloan dihitung petugas saat ditimbang; item satuan (pcs) langsung pasti harganya. Ketuk layanan untuk menambah ke keranjang, lalu kirim sekali jalan.
          </AppText>

          {cart.length > 0 && (
            <Card style={{ gap: SP.sm, borderColor: C.brand, borderWidth: 1.5 }} testID="cart-summary">
              <AppText weight="bold">Keranjang ({cart.length})</AppText>
              {cart.map((i) => (
                <View key={i.layanan_id} style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold" numberOfLines={1}>{i.nama} {i.satuan === "pcs" ? `× ${i.qty}` : ""}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 12 }}>
                      {i.satuan === "pcs" ? rupiah(i.qty * i.harga) : "Harga ditentukan saat ditimbang"}
                    </AppText>
                  </View>
                  <Pressable onPress={() => removeFromCart(i.layanan_id)} hitSlop={10} testID={`cart-remove-${i.layanan_id}`}>
                    <Ionicons name="close-circle" size={22} color={C.danger} />
                  </Pressable>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: C.border }} />
              <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                <AppText weight="bold">Perkiraan total</AppText>
                <AppText weight="bold">
                  {rupiah(cartTotal)}{cartAdaKiloan ? " + kiloan (ditimbang)" : ""}
                </AppText>
              </View>
              <Button title="Kirim Pesanan" icon="paper-plane" onPress={kirimPesanan} loading={busy} testID="cart-submit" />
            </Card>
          )}

          <View style={{ flexDirection: "row", gap: SP.sm, marginVertical: SP.xs, flexWrap: "wrap" }}>
            {[...new Set(services.map((s) => s.kategori))].map((c) => (
              <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} testID={`portal-cat-${c}`} />
            ))}
          </View>
          {services.filter((s) => s.kategori === cat).map((s) => {
            if (s.satuan === "pcs") {
              const qty = pcsQty[s.id] || 1;
              const inCart = cartHasItem(s.id);
              return (
                <Card key={s.id} style={[{ gap: SP.xs }, inCart && { borderColor: C.brand, borderWidth: 1.5 }]} testID={`pesan-pcs-${s.id}`}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                    <View style={{ flex: 1 }}>
                      <AppText weight="semibold">{s.nama}</AppText>
                      <AppText style={{ color: C.muted, fontSize: 13 }}>{rupiah(s.harga)} / {s.satuan}</AppText>
                    </View>
                  </View>
                  <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: SP.xs }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: SP.sm }}>
                      <Pressable onPress={() => setPcsQty((p) => ({ ...p, [s.id]: Math.max(1, qty - 1) }))} style={styles.stepBtn} hitSlop={10} testID={`pcs-minus-${s.id}`}>
                        <Ionicons name="remove" size={16} color={C.ink} />
                      </Pressable>
                      <AppText weight="semibold" style={{ minWidth: 24, textAlign: "center" }}>{qty}</AppText>
                      <Pressable onPress={() => setPcsQty((p) => ({ ...p, [s.id]: qty + 1 }))} style={styles.stepBtn} hitSlop={10} testID={`pcs-plus-${s.id}`}>
                        <Ionicons name="add" size={16} color={C.ink} />
                      </Pressable>
                    </View>
                    <Button
                      title={inCart ? `Update · ${rupiah(qty * s.harga)}` : `Tambah · ${rupiah(qty * s.harga)}`}
                      onPress={() => addToCart(s, qty)}
                      disabled={busy}
                      testID={`pesan-confirm-${s.id}`}
                    />
                  </View>
                </Card>
              );
            }
            const inCart = cartHasItem(s.id);
            return (
              <Pressable key={s.id} onPress={() => addToCart(s, 1)} disabled={busy} testID={`pesan-${s.id}`}>
                <Card style={[styles.svcRow, inCart && { borderColor: C.brand, borderWidth: 1.5 }]}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold">{s.nama}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 13 }}>{rupiah(s.harga)} / {s.satuan}</AppText>
                  </View>
                  <Ionicons name={inCart ? "checkmark-circle" : "add-circle"} size={24} color={inCart ? C.success : C.brand} />
                </Card>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  svcRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: SP.md },
  stepBtn: { width: 34, height: 34, borderRadius: R.sm, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
});
