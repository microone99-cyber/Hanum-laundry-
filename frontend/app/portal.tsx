import { useCallback, useMemo, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator, ScrollView, TextInput } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, StatusPill, EmptyState, Chip } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

type CartItem = { id: string; nama: string; harga: number; satuan: string; kategori: string; qty: number };

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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [catatan, setCatatan] = useState("");
  const [antar, setAntar] = useState<"jemput" | "antar" | null>(null);
  const [cat, setCat] = useState("Semua");
  const [err, setErr] = useState("");

  const load = useCallback(async () => {
    setErr("");
    try {
      const [mine, svc] = await Promise.all([api.get("/orders/mine"), api.get("/services")]);
      setList(mine);
      setServices(svc.filter((s: any) => s.aktif));
    } catch {
      setErr("Gagal memuat data. Tarik ke bawah untuk coba lagi.");
    } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { if (user && !isStaff) load(); }, [load, user, isStaff]));

  if (authLoading) return null;
  if (!user) return <Redirect href="/login" />;
  if (isStaff) return <Redirect href="/(staff)/dashboard" />;

  const categories = useMemo(() => ["Semua", ...Array.from(new Set(services.map((s) => s.kategori)))], [services]);
  const filteredServices = cat === "Semua" ? services : services.filter((s) => s.kategori === cat);

  const claim = async () => {
    if (!kode.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/orders/claim", { kode: kode.trim() });
      setMsg(`✓ Berhasil klaim: ${r.nomor_invoice}`);
      setKode(""); load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const toggleCart = (s: any) =>
    setCart((c) => {
      const exists = c.find((i) => i.id === s.id);
      if (exists) return c.filter((i) => i.id !== s.id);
      return [...c, { id: s.id, nama: s.nama, harga: s.harga, satuan: s.satuan, kategori: s.kategori, qty: 1 }];
    });

  const setQty = (id: string, qty: number) => {
    if (qty < 1) { setCart((c) => c.filter((i) => i.id !== id)); return; }
    setCart((c) => c.map((i) => i.id === id ? { ...i, qty } : i));
  };

  const pesan = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const prefix = antar === "jemput" ? "[Minta Dijemput] " : antar === "antar" ? "[Minta Diantar] " : "";
      await api.post("/orders/customer", {
        items: cart.map((i) => ({ nama: i.nama, harga: i.harga, satuan: i.satuan, qty: i.qty })),
        catatan: [prefix, catatan].filter(Boolean).join("").trim(),
      });
      setOrderSheet(false);
      setCart([]); setCatatan(""); setAntar(null); setCat("Semua");
      load();
    } catch (e: any) {
      setMsg(e?.message || "Gagal mengirim pesanan");
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => { await api.post(`/orders/${id}/cancel`); load(); };

  const totalPcs = cart.filter((i) => i.satuan === "pcs").reduce((a, i) => a + i.harga * i.qty, 0);
  const hasKg = cart.some((i) => i.satuan === "kg");

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Laundry Saya" subtitle={user.nama}
        right={<Pressable onPress={logout} hitSlop={8} testID="portal-logout"><Ionicons name="log-out-outline" size={24} color={C.danger} /></Pressable>} />

      <View style={styles.topBtns}>
        <Button title="Klaim Nota" variant="outline" icon="ticket-outline" onPress={() => { setMsg(""); setClaimSheet(true); }} style={{ flex: 1 }} testID="open-claim" />
        <Button title="Pesan Laundry" icon="add" onPress={() => { setCart([]); setCatatan(""); setAntar(null); setCat("Semua"); setMsg(""); setOrderSheet(true); }} style={{ flex: 1 }} testID="open-pesan" />
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.brand} size="large" /></View>
      ) : err ? (
        <View style={styles.center}>
          <Ionicons name="cloud-offline-outline" size={40} color={C.muted} />
          <AppText style={{ color: C.muted, marginTop: SP.md, textAlign: "center" }}>{err}</AppText>
          <Button title="Coba Lagi" onPress={load} style={{ marginTop: SP.lg }} />
        </View>
      ) : (
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
                {item.items?.length > 0 && (
                  <View style={{ marginTop: SP.sm, gap: 3 }}>
                    {item.items.map((it: any, idx: number) => (
                      <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                        <AppText style={{ fontSize: 12, color: C.inkMuted, flex: 1 }} numberOfLines={1}>
                          {it.nama_layanan}{it.satuan === "pcs" ? ` × ${it.qty} pcs` : " (ditimbang)"}
                        </AppText>
                        {it.satuan === "pcs" && (
                          <AppText weight="semibold" style={{ fontSize: 12 }}>{rupiah(it.harga * it.qty)}</AppText>
                        )}
                      </View>
                    ))}
                  </View>
                )}
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SP.sm }}>
                  <AppText>{item.perlu_timbang ? "Menunggu ditimbang" : rupiah(item.total)}</AppText>
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
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
          <AppText weight="semibold" style={{ fontSize: 14, marginBottom: SP.sm }}>Antar jemput?</AppText>
          <View style={{ flexDirection: "row", gap: SP.sm, marginBottom: SP.md }}>
            {(["jemput", "antar"] as const).map((v) => (
              <Pressable key={v} onPress={() => setAntar(antar === v ? null : v)} style={[styles.antarBtn, antar === v && styles.antarBtnActive]}>
                <AppText style={{ fontSize: 13, color: antar === v ? C.brand : C.ink }}>
                  {v === "jemput" ? "🛵 Minta Dijemput" : "📦 Minta Diantar"}
                </AppText>
              </Pressable>
            ))}
          </View>

          <AppText style={{ color: C.muted, fontSize: 13, marginBottom: SP.md, lineHeight: 19 }}>
            {"Geser kategori untuk lihat paket lainnya.\nKiloan dihitung saat ditimbang; pcs langsung pasti harganya."}
          </AppText>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingBottom: SP.sm }} style={{ marginBottom: SP.md }}>
            {categories.map((c) => (
              <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} testID={`cat-${c}`} />
            ))}
          </ScrollView>

          <View style={{ gap: SP.sm }}>
            {filteredServices.map((s) => {
              const cartItem = cart.find((i) => i.id === s.id);
              const inCart = !!cartItem;
              const isPcs = s.satuan === "pcs";
              return (
                <View key={s.id} style={[styles.svcCard, inCart && styles.svcCardActive]}>
                  <Pressable style={{ flex: 1, paddingVertical: 2 }} onPress={() => toggleCart(s)} testID={`pesan-${s.id}`}>
                    <AppText weight="semibold">{s.nama}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 13 }}>{rupiah(s.harga)} / {s.satuan}</AppText>
                  </Pressable>
                  {inCart && isPcs ? (
                    <View style={styles.stepper}>
                      <Pressable style={styles.stepBtn} onPress={() => setQty(s.id, cartItem!.qty - 1)} testID={`qty-minus-${s.id}`}>
                        <Ionicons name="remove" size={16} color={C.ink} />
                      </Pressable>
                      <TextInput style={styles.qtyInput} keyboardType="number-pad" value={String(cartItem!.qty)} onChangeText={(t) => setQty(s.id, parseInt(t) || 1)} />
                      <Pressable style={styles.stepBtn} onPress={() => setQty(s.id, cartItem!.qty + 1)} testID={`qty-plus-${s.id}`}>
                        <Ionicons name="add" size={16} color={C.ink} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable onPress={() => toggleCart(s)} hitSlop={8}>
                      <Ionicons name={inCart ? "checkmark-circle" : "add-circle"} size={26} color={inCart ? C.success : C.brand} />
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>

          {cart.length > 0 && (
            <View style={{ marginTop: SP.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm }}>
                <View style={styles.accent} />
                <AppText weight="bold" style={{ fontSize: 14, flex: 1 }}>Pesanan Kamu</AppText>
                <View style={styles.badge}><AppText weight="bold" style={{ color: "#fff", fontSize: 11 }}>{cart.length} item</AppText></View>
              </View>
              <Card style={{ backgroundColor: C.brandTint, borderColor: C.brandTint2, gap: SP.sm }}>
                {cart.map((i) => (
                  <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: SP.sm }}>
                    <Ionicons name="checkmark-circle" size={15} color={C.brand} />
                    <AppText style={{ flex: 1, fontSize: 13 }}>{i.nama}{i.satuan === "pcs" ? ` × ${i.qty}` : ""}</AppText>
                    <AppText weight="semibold" style={{ fontSize: 12, color: C.muted }}>{i.satuan === "kg" ? "ditimbang" : rupiah(i.harga * i.qty)}</AppText>
                  </View>
                ))}
                {totalPcs > 0 && (
                  <View style={styles.totalRow}>
                    <AppText style={{ fontSize: 12, color: C.muted }}>Total item pcs</AppText>
                    <AppText weight="bold" style={{ color: C.brand }}>{rupiah(totalPcs)}</AppText>
                  </View>
                )}
                {hasKg && <AppText style={{ fontSize: 11, color: C.muted }}>*Harga kiloan dihitung petugas saat ditimbang</AppText>}
              </Card>
              <Field label="Catatan (opsional)" placeholder="Misal: jangan pakai pewangi" value={catatan} onChangeText={setCatatan} multiline style={{ marginTop: SP.md }} />
              {msg ? <AppText style={{ color: C.danger, marginTop: SP.sm }}>{msg}</AppText> : null}
              <Button title={`Kirim Pesanan (${cart.length} layanan)`} icon="send" onPress={pesan} loading={busy} size="lg" style={{ marginTop: SP.md }} testID="pesan-submit" />
            </View>
          )}
          <View style={{ height: 40 }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: SP.xl },
  topBtns: { flexDirection: "row", gap: SP.sm, padding: SP.lg, paddingBottom: SP.sm },
  antarBtn: { flex: 1, paddingVertical: 10, paddingHorizontal: SP.sm, borderRadius: R.pill, borderWidth: 1.5, borderColor: C.border, alignItems: "center", backgroundColor: C.panel },
  antarBtnActive: { borderColor: C.brand, backgroundColor: C.brandTint },
  svcCard: { flexDirection: "row", alignItems: "center", gap: SP.md, backgroundColor: C.panel, borderRadius: R.lg, padding: SP.md, borderWidth: 1, borderColor: C.border },
  svcCardActive: { borderColor: C.brand, borderWidth: 1.5, backgroundColor: C.brandTint },
  stepper: { flexDirection: "row", alignItems: "center", gap: 4 },
  stepBtn: { width: 30, height: 30, borderRadius: 8, backgroundColor: C.panel, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  qtyInput: { width: 34, textAlign: "center", fontFamily: F.bold, fontSize: 14, color: C.ink },
  accent: { width: 3, height: 16, borderRadius: 99, backgroundColor: C.brand },
  badge: { backgroundColor: C.brand, borderRadius: 99, paddingHorizontal: 8, paddingVertical: 2 },
  totalRow: { flexDirection: "row", justifyContent: "space-between", borderTopWidth: 1, borderTopColor: C.brandTint2, paddingTop: SP.sm, marginTop: SP.xs },
});