import { useCallback, useMemo, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, StatusPill, EmptyState, Chip } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

type CartItem = { id: string; nama: string; harga: number; satuan: string; kategori: string };

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

  const load = useCallback(async () => {
    try {
      const [mine, svc] = await Promise.all([api.get("/orders/mine"), api.get("/services")]);
      setList(mine);
      setServices(svc.filter((s: any) => s.aktif));
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

  const toggleCart = (s: any) => {
    setCart((c) => {
      const exists = c.find((i) => i.id === s.id);
      if (exists) return c.filter((i) => i.id !== s.id);
      return [...c, { id: s.id, nama: s.nama, harga: s.harga, satuan: s.satuan, kategori: s.kategori }];
    });
  };

  const pesan = async () => {
    if (cart.length === 0) return;
    setBusy(true);
    try {
      const antarInfo = antar === "jemput" ? "[Minta Dijemput] " : antar === "antar" ? "[Minta Diantar] " : "";
      const paketNama = cart.map((i) => i.nama).join(" + ");
      const catatanFull = [antarInfo + paketNama, catatan].filter(Boolean).join(" | ");
      await api.post("/orders/customer", {
        paket: cart[0].nama,
        harga: cart[0].harga,
        catatan: catatanFull,
      });
      setOrderSheet(false);
      setCart([]); setCatatan(""); setAntar(null); setCat("Semua");
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
        <Button title="Pesan Laundry" icon="add" onPress={() => { setCart([]); setCatatan(""); setAntar(null); setCat("Semua"); setOrderSheet(true); }} style={{ flex: 1 }} testID="open-pesan" />
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
                <View style={{ flexDirection: "row", justifyContent: "space-between", marginTop: SP.sm }}>
                  <AppText>{item.perlu_timbang ? "Menunggu ditimbang" : rupiah(item.total)}</AppText>
                  <AppText weight="semibold" style={{ color: item.status_bayar === "lunas" ? C.success : C.danger }}>{item.status_bayar === "lunas" ? "Lunas" : "Belum bayar"}</AppText>
                </View>
                {bisaBatal && <Button title="Batalkan Pesanan" variant="outline" icon="close" onPress={() => cancel(item.id)} style={{ marginTop: SP.md, borderColor: C.danger }} testID={`portal-cancel-${item.id}`} />}
              </Card>
            );
          }} />
      )}

      {/* Sheet Klaim */}
      <Sheet visible={claimSheet} onClose={() => setClaimSheet(false)} title="Klaim Pesanan" testID="claim-sheet">
        <View style={{ gap: SP.md }}>
          <AppText style={{ color: C.muted }}>Masukkan kode nota (tercetak di struk laundry Anda).</AppText>
          <Field label="Kode nota" autoCapitalize="none" value={kode} onChangeText={setKode} testID="claim-kode" />
          {msg ? <AppText style={{ color: msg.startsWith("✓") ? C.success : C.danger }} testID="claim-msg">{msg}</AppText> : null}
          <Button title="Klaim" onPress={claim} loading={busy} testID="claim-submit" />
        </View>
      </Sheet>

      {/* Sheet Pesan — dengan keranjang + kategori */}
      <Sheet visible={orderSheet} onClose={() => setOrderSheet(false)} title="Pesan Laundry" testID="pesan-sheet">
        <ScrollView showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">

          {/* Antar jemput */}
          <AppText weight="semibold" style={{ fontSize: 14, marginBottom: SP.sm }}>Antar jemput?</AppText>
          <View style={{ flexDirection: "row", gap: SP.sm, marginBottom: SP.md }}>
            <Pressable
              onPress={() => setAntar(antar === "jemput" ? null : "jemput")}
              style={[styles.antarBtn, antar === "jemput" && styles.antarBtnActive]}
            >
              <AppText style={{ fontSize: 13, color: antar === "jemput" ? C.brand : C.ink }}>🛵 Minta Dijemput</AppText>
            </Pressable>
            <Pressable
              onPress={() => setAntar(antar === "antar" ? null : "antar")}
              style={[styles.antarBtn, antar === "antar" && styles.antarBtnActive]}
            >
              <AppText style={{ fontSize: 13, color: antar === "antar" ? C.brand : C.ink }}>📦 Minta Diantar</AppText>
            </Pressable>
          </View>

          {/* Info */}
          <AppText style={{ color: C.muted, fontSize: 13, marginBottom: SP.md, lineHeight: 19 }}>
            Geser kategori di bawah untuk lihat paket lainnya.{"\n"}
            Cucian kiloan dihitung petugas saat ditimbang; item satuan (pcs) langsung pasti harganya.
          </AppText>

          {/* Filter kategori horizontal */}
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingBottom: SP.sm }} style={{ marginBottom: SP.md }}>
            {categories.map((c) => (
              <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} testID={`cat-${c}`} />
            ))}
          </ScrollView>

          {/* Daftar layanan */}
          <View style={{ gap: SP.sm }}>
            {filteredServices.map((s) => {
              const inCart = cart.some((i) => i.id === s.id);
              return (
                <Pressable key={s.id} onPress={() => toggleCart(s)} testID={`pesan-${s.id}`}>
                  <Card style={[styles.svcRow, inCart && { borderColor: C.brand, borderWidth: 1.5, backgroundColor: C.brandTint }]}>
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

          {/* Keranjang — muncul kalau ada item */}
          {cart.length > 0 && (
            <View style={{ marginTop: SP.lg }}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: SP.sm, marginBottom: SP.sm }}>
                <View style={styles.sectionAccent} />
                <AppText weight="bold" style={{ fontSize: 14, flex: 1 }}>Pesanan Kamu</AppText>
                <View style={styles.cartBadge}>
                  <AppText weight="bold" style={{ color: "#fff", fontSize: 11 }}>{cart.length} item</AppText>
                </View>
              </View>

              <Card style={{ backgroundColor: C.brandTint, borderColor: C.brandTint2, gap: SP.sm }}>
                {cart.map((i) => (
                  <View key={i.id} style={{ flexDirection: "row", alignItems: "center", gap: SP.sm }}>
                    <Ionicons name="checkmark-circle" size={16} color={C.brand} />
                    <AppText style={{ flex: 1, fontSize: 13 }}>{i.nama}</AppText>
                    <AppText weight="semibold" style={{ fontSize: 12, color: C.muted }}>{i.satuan === "kg" ? "ditimbang" : rupiah(i.harga)}</AppText>
                  </View>
                ))}
                <AppText style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>*Harga kiloan dihitung petugas saat ditimbang</AppText>
              </Card>

              <Field
                label="Catatan (opsional)"
                placeholder="Misal: jangan pakai pewangi, ada noda di baju merah"
                value={catatan}
                onChangeText={setCatatan}
                multiline
                style={{ marginTop: SP.md }}
              />

              <Button
                title={`Kirim Pesanan (${cart.length} layanan)`}
                icon="send"
                onPress={pesan}
                loading={busy}
                size="lg"
                style={{ marginTop: SP.md }}
                testID="pesan-submit"
              />
            </View>
          )}

          <View style={{ height: SP.xxl }} />
        </ScrollView>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  svcRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: SP.md },
  antarBtn: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: SP.sm,
    borderRadius: R.pill,
    borderWidth: 1.5,
    borderColor: C.border,
    alignItems: "center",
    backgroundColor: C.panel,
  },
  antarBtnActive: {
    borderColor: C.brand,
    backgroundColor: C.brandTint,
  },
  sectionAccent: { width: 3, height: 16, borderRadius: 99, backgroundColor: C.brand },
  cartBadge: {
    backgroundColor: C.brand,
    borderRadius: 99,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
});
