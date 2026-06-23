import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID, todayISO } from "@/src/format";
import { C, SP, R } from "@/src/theme";

export default function Cash() {
  const { user } = useAuth();
  const router = useRouter();
  const canDelete = user && ["owner", "admin"].includes(user.role);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [jenis, setJenis] = useState("keluar");
  const [nominal, setNominal] = useState("");
  const [keterangan, setKeterangan] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api.get("/cash")); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const now = new Date();
  const bulan = list.filter((k) => { const d = new Date(k.tanggal); return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear(); });
  const masuk = bulan.filter((k) => k.jenis === "masuk").reduce((a, k) => a + (k.nominal || 0), 0);
  const keluar = bulan.filter((k) => k.jenis === "keluar").reduce((a, k) => a + (k.nominal || 0), 0);

  const save = async () => {
    if (!(parseInt(nominal) > 0)) return;
    setSaving(true);
    try {
      await api.post("/cash", { tanggal: todayISO(), jenis, nominal: parseInt(nominal), keterangan: keterangan.trim() });
      setSheet(false); setNominal(""); setKeterangan(""); setJenis("keluar"); load();
    } finally { setSaving(false); }
  };
  const remove = async (id: string) => { await api.del(`/cash/${id}`); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Kas / Laci" subtitle="Buku kas masuk & keluar" back onBack={() => router.back()}
        right={<Pressable onPress={() => setSheet(true)} style={styles.addBtn} testID="add-cash-button"><Ionicons name="add" size={22} color="#fff" /></Pressable>} />
      <View style={{ padding: SP.lg, gap: SP.sm }}>
        <View style={{ flexDirection: "row", gap: SP.sm }}>
          <Card style={{ flex: 1 }}><AppText style={{ color: C.muted, fontSize: 12 }}>Masuk</AppText><AppText weight="bold" style={{ color: C.success, fontSize: 16 }}>{rupiah(masuk)}</AppText></Card>
          <Card style={{ flex: 1 }}><AppText style={{ color: C.muted, fontSize: 12 }}>Keluar</AppText><AppText weight="bold" style={{ color: C.danger, fontSize: 16 }}>{rupiah(keluar)}</AppText></Card>
        </View>
        <Card><AppText style={{ color: C.muted, fontSize: 12 }}>Saldo (masuk − keluar)</AppText><AppText weight="extrabold" style={{ fontSize: 22 }}>{rupiah(masuk - keluar)}</AppText></Card>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <FlatList data={list} keyExtractor={(k) => k.id}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="cash-outline" title="Belum ada catatan kas" />}
          renderItem={({ item }) => (
            <Card style={styles.row} testID={`cash-${item.id}`}>
              <View style={[styles.dir, { backgroundColor: item.jenis === "masuk" ? C.siap_bg : C.batal_bg }]}>
                <Ionicons name={item.jenis === "masuk" ? "arrow-down" : "arrow-up"} size={18} color={item.jenis === "masuk" ? C.success : C.danger} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold">{item.keterangan || (item.jenis === "masuk" ? "Kas masuk" : "Kas keluar")}</AppText>
                <AppText style={{ color: C.muted, fontSize: 12 }}>{tglID(item.tanggal)}</AppText>
              </View>
              <AppText weight="bold" style={{ color: item.jenis === "masuk" ? C.success : C.danger }}>{item.jenis === "masuk" ? "+" : "−"}{rupiah(item.nominal)}</AppText>
              {canDelete && <Pressable onPress={() => remove(item.id)} hitSlop={8} testID={`delete-cash-${item.id}`}><Ionicons name="trash-outline" size={18} color={C.muted} /></Pressable>}
            </Card>
          )} />
      )}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title="Catatan Kas" testID="cash-sheet">
        <View style={{ gap: SP.md }}>
          <View style={styles.seg}>
            {[["keluar", "Keluar"], ["masuk", "Masuk"]].map(([v, l]) => (
              <Pressable key={v} onPress={() => setJenis(v)} style={[styles.segItem, jenis === v && { backgroundColor: C.brand }]} testID={`cash-jenis-${v}`}>
                <AppText weight="semibold" style={{ color: jenis === v ? "#fff" : C.ink }}>{l}</AppText>
              </Pressable>
            ))}
          </View>
          <Field label="Nominal (Rp)" keyboardType="number-pad" value={nominal} onChangeText={setNominal} testID="cash-nominal" />
          <Field label="Keterangan" value={keterangan} onChangeText={setKeterangan} testID="cash-keterangan" />
          <Button title="Simpan" onPress={save} loading={saving} testID="cash-save" />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md },
  dir: { width: 38, height: 38, borderRadius: 19, alignItems: "center", justifyContent: "center" },
  seg: { flexDirection: "row", backgroundColor: C.panel2, borderRadius: R.md, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 12, borderRadius: R.sm, alignItems: "center" },
});
