import { useCallback, useMemo, useState } from "react";
import { View, ScrollView, StyleSheet, Pressable, ActivityIndicator, TextInput } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { AppText, Card, Button, Field, Chip } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { rupiah } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

type CartItem = { layanan_id: string; nama_layanan: string; tipe: string; satuan: string; qty: number; harga: number; kategori: string };

export default function POS() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [services, setServices] = useState<any[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [cat, setCat] = useState<string>("");
  const [cart, setCart] = useState<CartItem[]>([]);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [diskon, setDiskon] = useState("0");
  const [metode, setMetode] = useState("Tunai");
  const [statusBayar, setStatusBayar] = useState("lunas");
  const [bayar, setBayar] = useState("");
  const [catatan, setCatatan] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const [svc, cust] = await Promise.all([api.get("/services"), api.get("/customers")]);
      const active = svc.filter((s: any) => s.aktif);
      setServices(active);
      setCustomers(cust);
      if (!cat && active.length) setCat(active[0].kategori);
    } finally {
      setLoading(false);
    }
  }, [cat]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const categories = useMemo(() => [...new Set(services.map((s) => s.kategori))], [services]);
  const catServices = services.filter((s) => s.kategori === cat);

  const addItem = (s: any) => {
    setCart((c) => {
      const exist = c.find((i) => i.layanan_id === s.id);
      if (exist) return c;
      return [...c, { layanan_id: s.id, nama_layanan: s.nama, tipe: s.satuan === "kg" ? "kiloan" : "satuan", satuan: s.satuan, qty: 1, harga: s.harga, kategori: s.kategori }];
    });
  };
  const updateQty = (id: string, qty: number) => setCart((c) => c.map((i) => (i.layanan_id === id ? { ...i, qty: Math.max(0, qty) } : i)));
  const updateHarga = (id: string, harga: number) => setCart((c) => c.map((i) => (i.layanan_id === id ? { ...i, harga: Math.max(0, harga) } : i)));
  const removeItem = (id: string) => setCart((c) => c.filter((i) => i.layanan_id !== id));

  const subtotal = cart.reduce((a, i) => a + i.qty * i.harga, 0);
  const diskonPct = Math.min(100, Math.max(0, parseInt(diskon || "0") || 0));
  const diskonNom = Math.round((subtotal * diskonPct) / 100);
  const total = subtotal - diskonNom;

  const suggestions = nama.length >= 1 ? customers.filter((c) => c.nama.toLowerCase().includes(nama.toLowerCase())).slice(0, 3) : [];

  const save = async () => {
    if (cart.length === 0 || !nama.trim() || total <= 0) return;
    setSaving(true);
    try {
      const order = await api.post("/orders", {
        pelanggan_nama: nama.trim(),
        pelanggan_telepon: telepon.trim(),
        items: cart.map((i) => ({ layanan_id: i.layanan_id, nama_layanan: i.nama_layanan, tipe: i.tipe, satuan: i.satuan, qty: i.qty, harga: i.harga })),
        diskon: diskonPct,
        metode_bayar: metode,
        status_bayar: statusBayar,
        bayar: statusBayar === "lunas" ? (parseInt(bayar || "0") || total) : 0,
        catatan: catatan.trim(),
      });
      // reset
      setCart([]); setNama(""); setTelepon(""); setDiskon("0"); setBayar(""); setCatatan(""); setStatusBayar("lunas"); setMetode("Tunai");
      router.push(`/receipt/${order.id}?print=1`);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <Header title="Order Baru" />
        <View style={styles.center}><ActivityIndicator color={C.brand} /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Order Baru" subtitle="POS / Kasir" />
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: 180 }} keyboardShouldPersistTaps="handled">
        {/* Pilih layanan */}
        <AppText weight="bold" style={{ fontSize: 16, marginBottom: SP.sm }}>Pilih Layanan</AppText>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingVertical: 2 }} style={{ marginBottom: SP.md }}>
          {categories.map((c) => <Chip key={c} label={c} active={c === cat} onPress={() => setCat(c)} testID={`cat-${c}`} />)}
        </ScrollView>
        <View style={{ gap: SP.sm }}>
          {catServices.map((s) => {
            const inCart = cart.some((i) => i.layanan_id === s.id);
            return (
              <Pressable key={s.id} onPress={() => addItem(s)} testID={`service-${s.id}`}>
                <Card style={[styles.svcRow, inCart && { borderColor: C.brand, borderWidth: 1.5 }]}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold" numberOfLines={1}>{s.nama}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 13 }}>{rupiah(s.harga)} / {s.satuan}</AppText>
                  </View>
                  <Ionicons name={inCart ? "checkmark-circle" : "add-circle"} size={26} color={inCart ? C.success : C.brand} />
                </Card>
              </Pressable>
            );
          })}
        </View>

        {/* Keranjang */}
        <AppText weight="bold" style={{ fontSize: 16, marginTop: SP.xl, marginBottom: SP.sm }}>Keranjang ({cart.length})</AppText>
        {cart.length === 0 ? (
          <Card><AppText style={{ color: C.muted }}>Belum ada item. Ketuk layanan di atas untuk menambah.</AppText></Card>
        ) : (
          <View style={{ gap: SP.sm }}>
            {cart.map((i) => (
              <Card key={i.layanan_id} testID={`cart-${i.layanan_id}`}>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText weight="semibold" style={{ flex: 1 }} numberOfLines={1}>{i.nama_layanan}</AppText>
                  <Pressable onPress={() => removeItem(i.layanan_id)} hitSlop={8} testID={`cart-remove-${i.layanan_id}`}>
                    <Ionicons name="close-circle" size={22} color={C.danger} />
                  </Pressable>
                </View>
                <View style={styles.qtyRow}>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: C.muted, fontSize: 12 }}>{i.satuan === "kg" ? "Berat (kg)" : "Jumlah (pcs)"}</AppText>
                    <View style={styles.stepper}>
                      <Pressable onPress={() => updateQty(i.layanan_id, +(i.qty - (i.satuan === "kg" ? 0.5 : 1)).toFixed(1))} style={styles.stepBtn} testID={`qty-minus-${i.layanan_id}`}><Ionicons name="remove" size={18} color={C.ink} /></Pressable>
                      <TextInput
                        style={styles.qtyInput}
                        keyboardType="decimal-pad"
                        value={String(i.qty)}
                        onChangeText={(t) => updateQty(i.layanan_id, parseFloat(t.replace(",", ".")) || 0)}
                        testID={`qty-input-${i.layanan_id}`}
                      />
                      <Pressable onPress={() => updateQty(i.layanan_id, +(i.qty + (i.satuan === "kg" ? 0.5 : 1)).toFixed(1))} style={styles.stepBtn} testID={`qty-plus-${i.layanan_id}`}><Ionicons name="add" size={18} color={C.ink} /></Pressable>
                    </View>
                  </View>
                  <View style={{ flex: 1 }}>
                    <AppText style={{ color: C.muted, fontSize: 12 }}>Harga / {i.satuan}</AppText>
                    <TextInput
                      style={[styles.qtyInput, { borderWidth: 1, borderColor: C.border, borderRadius: R.md, height: 40, marginTop: 4 }]}
                      keyboardType="number-pad"
                      value={String(i.harga)}
                      onChangeText={(t) => updateHarga(i.layanan_id, parseInt(t) || 0)}
                      testID={`harga-input-${i.layanan_id}`}
                    />
                  </View>
                  <View style={{ alignItems: "flex-end", justifyContent: "flex-end" }}>
                    <AppText style={{ color: C.muted, fontSize: 12 }}>Subtotal</AppText>
                    <AppText weight="bold" style={{ marginTop: 8 }}>{rupiah(i.qty * i.harga)}</AppText>
                  </View>
                </View>
              </Card>
            ))}
          </View>
        )}

        {/* Pelanggan & pembayaran */}
        <AppText weight="bold" style={{ fontSize: 16, marginTop: SP.xl, marginBottom: SP.sm }}>Data Pelanggan</AppText>
        <Card style={{ gap: SP.md }}>
          <View>
            <Field label="Nama pelanggan" value={nama} onChangeText={setNama} testID="pos-nama-input" />
            {suggestions.length > 0 && (
              <View style={styles.suggestBox}>
                {suggestions.map((s) => (
                  <Pressable key={s.id} onPress={() => { setNama(s.nama); setTelepon(s.telepon || ""); }} style={styles.suggestRow} testID={`suggest-${s.id}`}>
                    <Ionicons name="person-circle-outline" size={18} color={C.muted} />
                    <AppText style={{ flex: 1 }}>{s.nama}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 12 }}>{s.telepon}</AppText>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
          <Field label="No. WhatsApp" keyboardType="phone-pad" value={telepon} onChangeText={setTelepon} testID="pos-telepon-input" />
          <Field label="Diskon (%)" keyboardType="number-pad" value={diskon} onChangeText={setDiskon} testID="pos-diskon-input" />

          <View>
            <AppText weight="semibold" style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Metode bayar</AppText>
            <View style={styles.seg}>
              {["Tunai", "QRIS", "Transfer"].map((m) => (
                <Pressable key={m} onPress={() => setMetode(m)} style={[styles.segItem, metode === m && styles.segActive]} testID={`metode-${m}`}>
                  <AppText weight="semibold" style={{ color: metode === m ? "#fff" : C.ink, fontSize: 13 }}>{m}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
          <View>
            <AppText weight="semibold" style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Status bayar</AppText>
            <View style={styles.seg}>
              {[["lunas", "Lunas"], ["belum", "Belum bayar"]].map(([v, l]) => (
                <Pressable key={v} onPress={() => setStatusBayar(v)} style={[styles.segItem, statusBayar === v && styles.segActive]} testID={`statusbayar-${v}`}>
                  <AppText weight="semibold" style={{ color: statusBayar === v ? "#fff" : C.ink, fontSize: 13 }}>{l}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
          {statusBayar === "lunas" && (
            <Field label="Uang diterima" keyboardType="number-pad" value={bayar} onChangeText={setBayar} placeholder={String(total)} testID="pos-bayar-input" />
          )}
          <Field label="Catatan (opsional)" value={catatan} onChangeText={setCatatan} multiline testID="pos-catatan-input" />
        </Card>
      </ScrollView>

      {/* Sticky total bar */}
      <View style={[styles.bottomBar, { paddingBottom: insets.bottom + SP.sm }]}>
        <View style={{ flex: 1 }}>
          <AppText style={{ color: C.muted, fontSize: 12 }}>Total{diskonPct > 0 ? ` (diskon ${diskonPct}%)` : ""}</AppText>
          <AppText weight="extrabold" style={{ fontSize: 22 }}>{rupiah(total)}</AppText>
        </View>
        <Button title="Simpan & Cetak" icon="print" onPress={save} loading={saving} disabled={cart.length === 0 || !nama.trim()} style={{ minWidth: 170 }} testID="pos-save-button" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  svcRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: SP.md },
  qtyRow: { flexDirection: "row", gap: SP.md, marginTop: SP.sm, alignItems: "flex-end" },
  stepper: { flexDirection: "row", alignItems: "center", marginTop: 4, gap: 4 },
  stepBtn: { width: 34, height: 40, borderRadius: R.sm, backgroundColor: C.panel2, borderWidth: 1, borderColor: C.border, alignItems: "center", justifyContent: "center" },
  qtyInput: { flex: 1, textAlign: "center", fontFamily: F.semibold, fontSize: 15, color: C.ink, height: 40, minWidth: 50 },
  suggestBox: { marginTop: 4, backgroundColor: C.panel2, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
  suggestRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, paddingHorizontal: SP.md, paddingVertical: 10 },
  seg: { flexDirection: "row", backgroundColor: C.panel2, borderRadius: R.md, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: "center" },
  segActive: { backgroundColor: C.brand },
  bottomBar: {
    position: "absolute", bottom: 0, left: 0, right: 0,
    flexDirection: "row", alignItems: "center", gap: SP.md,
    backgroundColor: C.panel, borderTopWidth: 1, borderTopColor: C.border,
    paddingHorizontal: SP.lg, paddingTop: SP.md,
  },
});
