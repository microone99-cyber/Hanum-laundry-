import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, Pill, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID, todayISO } from "@/src/format";
import { C, SP, R } from "@/src/theme";

const KATEGORI = ["Gas LPG", "Deterjen", "Pewangi", "Plastik Kemasan", "Listrik", "Air", "Gaji", "Sewa", "Lainnya"];
const STATUS = ["Sudah Dibayar", "Menunggu Pembayaran", "Dibatalkan"];

export default function Expenses() {
  const { user } = useAuth();
  const router = useRouter();
  const canDelete = user && ["owner", "admin"].includes(user.role);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [kategori, setKategori] = useState(KATEGORI[0]);
  const [nama, setNama] = useState("");
  const [jumlah, setJumlah] = useState("1");
  const [hargaSatuan, setHargaSatuan] = useState("");
  const [status, setStatus] = useState(STATUS[0]);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api.get("/expenses")); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const total = (parseFloat(jumlah) || 0) * (parseInt(hargaSatuan) || 0);
  const now = new Date();
  const bulanIni = list.filter((e) => { const d = new Date(e.tanggal); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear() && e.status !== "Dibatalkan"; });
  const totalBulan = bulanIni.reduce((a, e) => a + (e.total || 0), 0);

  const save = async () => {
    if (!nama.trim() || total <= 0) return;
    setSaving(true);
    try {
      await api.post("/expenses", { tanggal: todayISO(), kategori, nama: nama.trim(), jumlah: parseFloat(jumlah) || 1, satuan: "pcs", harga_satuan: parseInt(hargaSatuan) || 0, total, status });
      setSheet(false); setNama(""); setJumlah("1"); setHargaSatuan(""); setStatus(STATUS[0]); load();
    } finally { setSaving(false); }
  };

  const remove = async (id: string) => { await api.del(`/expenses/${id}`); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Pengeluaran" subtitle="Biaya operasional" back onBack={() => router.back()}
        right={<Pressable onPress={() => setSheet(true)} style={styles.addBtn} testID="add-expense-button"><Ionicons name="add" size={22} color="#fff" /></Pressable>} />
      <View style={{ padding: SP.lg, paddingBottom: SP.sm }}>
        <Card style={{ backgroundColor: C.danger }}>
          <AppText style={{ color: "#fff", opacity: 0.85, fontSize: 13 }}>Total pengeluaran bulan ini</AppText>
          <AppText weight="extrabold" style={{ color: "#fff", fontSize: 26 }}>{rupiah(totalBulan)}</AppText>
        </Card>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <FlatList data={list} keyExtractor={(e) => e.id}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="wallet-outline" title="Belum ada pengeluaran" />}
          renderItem={({ item }) => (
            <Card style={styles.row} testID={`expense-${item.id}`}>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">{item.nama}</AppText>
                <AppText style={{ color: C.muted, fontSize: 12 }}>{item.kategori} · {tglID(item.tanggal)}</AppText>
                <View style={{ marginTop: 4 }}>
                  <Pill text={item.status} fg={item.status === "Dibatalkan" ? C.batal_fg : item.status === "Sudah Dibayar" ? C.siap_fg : C.role_kasir} bg={item.status === "Dibatalkan" ? C.batal_bg : item.status === "Sudah Dibayar" ? C.siap_bg : "#FEF3C7"} />
                </View>
              </View>
              <View style={{ alignItems: "flex-end", gap: 6 }}>
                <AppText weight="bold" style={{ color: C.danger }}>{rupiah(item.total)}</AppText>
                {canDelete && <Pressable onPress={() => remove(item.id)} hitSlop={8} testID={`delete-expense-${item.id}`}><Ionicons name="trash-outline" size={18} color={C.muted} /></Pressable>}
              </View>
            </Card>
          )} />
      )}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Pengeluaran Baru" testID="expense-sheet">
        <View style={{ gap: SP.md }}>
          <AppText weight="semibold" style={{ fontSize: 13, color: C.muted }}>Kategori</AppText>
          <View style={styles.chipWrap}>
            {KATEGORI.map((k) => <Pressable key={k} onPress={() => setKategori(k)} style={[styles.kchip, kategori === k && { backgroundColor: C.brand, borderColor: C.brand }]} testID={`exp-kat-${k}`}><AppText style={{ color: kategori === k ? "#fff" : C.ink, fontSize: 13 }}>{k}</AppText></Pressable>)}
          </View>
          <Field label="Nama barang / keperluan" value={nama} onChangeText={setNama} testID="expense-nama" />
          <View style={{ flexDirection: "row", gap: SP.md }}>
            <View style={{ flex: 1 }}><Field label="Jumlah" keyboardType="decimal-pad" value={jumlah} onChangeText={setJumlah} testID="expense-jumlah" /></View>
            <View style={{ flex: 1 }}><Field label="Harga satuan" keyboardType="number-pad" value={hargaSatuan} onChangeText={setHargaSatuan} testID="expense-harga" /></View>
          </View>
          <View style={styles.chipWrap}>
            {STATUS.map((s) => <Pressable key={s} onPress={() => setStatus(s)} style={[styles.kchip, status === s && { backgroundColor: C.ink, borderColor: C.ink }]} testID={`exp-status-${s}`}><AppText style={{ color: status === s ? "#fff" : C.ink, fontSize: 12 }}>{s}</AppText></Pressable>)}
          </View>
          <AppText weight="bold" style={{ fontSize: 16 }}>Total: {rupiah(total)}</AppText>
          <Button title="Simpan" onPress={save} loading={saving} testID="expense-save" />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "flex-start", gap: SP.md },
  chipWrap: { flexDirection: "row", flexWrap: "wrap", gap: SP.sm },
  kchip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: R.pill, borderWidth: 1, borderColor: C.border, backgroundColor: C.panel },
});
