import { useCallback, useState } from "react";
import { View, SectionList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { AppText, Card, Button, Field, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah } from "@/src/format";
import { C, SP, R } from "@/src/theme";

export default function ServicesManage() {
  const router = useRouter();
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nama, setNama] = useState("");
  const [kategori, setKategori] = useState("");
  const [satuan, setSatuan] = useState("kg");
  const [harga, setHarga] = useState("");
  const [estimasi, setEstimasi] = useState("72");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api.get("/services")); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const cats = [...new Set(list.map((s) => s.kategori))];
  const sections = cats.map((c) => ({ title: c, data: list.filter((s) => s.kategori === c) }));

  const openNew = () => { setEditing(null); setNama(""); setKategori(cats[0] || "Umum"); setSatuan("kg"); setHarga(""); setEstimasi("72"); setSheet(true); };
  const openEdit = (s: any) => { setEditing(s); setNama(s.nama); setKategori(s.kategori); setSatuan(s.satuan); setHarga(String(s.harga)); setEstimasi(String(s.estimasi_jam)); setSheet(true); };

  const save = async () => {
    if (!nama.trim() || !kategori.trim()) return;
    setSaving(true);
    try {
      const body = { nama: nama.trim(), kategori: kategori.trim(), satuan, harga: parseInt(harga) || 0, estimasi_jam: parseInt(estimasi) || 72, aktif: editing ? editing.aktif : true };
      if (editing) await api.put(`/services/${editing.id}`, body);
      else await api.post("/services", body);
      setSheet(false); load();
    } finally { setSaving(false); }
  };
  const toggle = async (s: any) => { await api.put(`/services/${s.id}`, { ...s, aktif: !s.aktif }); load(); };
  const remove = async (s: any) => { await api.del(`/services/${s.id}`); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Layanan & Tarif" subtitle={`${list.length} layanan`} back onBack={() => router.back()}
        right={<Pressable onPress={openNew} style={styles.addBtn} testID="add-service-button"><Ionicons name="add" size={22} color="#fff" /></Pressable>} />
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <SectionList
          sections={sections}
          keyExtractor={(s) => s.id}
          contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl }}
          ListEmptyComponent={<EmptyState icon="pricetags-outline" title="Belum ada layanan" />}
          renderSectionHeader={({ section }) => <AppText weight="bold" style={{ fontSize: 15, marginTop: SP.md, marginBottom: SP.sm }}>{section.title}</AppText>}
          renderItem={({ item }) => (
            <Card style={[styles.row, { marginBottom: SP.sm, opacity: item.aktif ? 1 : 0.5 }]} testID={`service-row-${item.id}`}>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" numberOfLines={1}>{item.nama}</AppText>
                <AppText style={{ color: C.muted, fontSize: 12 }}>{rupiah(item.harga)} / {item.satuan} · {item.estimasi_jam} jam</AppText>
              </View>
              <Pressable onPress={() => toggle(item)} hitSlop={6} style={styles.ic} testID={`toggle-service-${item.id}`}><Ionicons name={item.aktif ? "eye" : "eye-off"} size={20} color={item.aktif ? C.success : C.muted} /></Pressable>
              <Pressable onPress={() => openEdit(item)} hitSlop={6} style={styles.ic} testID={`edit-service-${item.id}`}><Ionicons name="create-outline" size={20} color={C.brand} /></Pressable>
              <Pressable onPress={() => remove(item)} hitSlop={6} style={styles.ic} testID={`remove-service-${item.id}`}><Ionicons name="trash-outline" size={20} color={C.danger} /></Pressable>
            </Card>
          )}
        />
      )}
      <Sheet visible={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Layanan" : "Layanan Baru"} testID="service-sheet">
        <View style={{ gap: SP.md }}>
          <Field label="Nama layanan" value={nama} onChangeText={setNama} testID="service-nama" />
          <Field label="Kategori" value={kategori} onChangeText={setKategori} testID="service-kategori" />
          <View>
            <AppText weight="semibold" style={{ fontSize: 13, color: C.muted, marginBottom: 6 }}>Satuan</AppText>
            <View style={styles.seg}>
              {[["kg", "Per kg"], ["pcs", "Per pcs"]].map(([v, l]) => (
                <Pressable key={v} onPress={() => setSatuan(v)} style={[styles.segItem, satuan === v && { backgroundColor: C.brand }]} testID={`service-satuan-${v}`}>
                  <AppText weight="semibold" style={{ color: satuan === v ? "#fff" : C.ink }}>{l}</AppText>
                </Pressable>
              ))}
            </View>
          </View>
          <View style={{ flexDirection: "row", gap: SP.md }}>
            <View style={{ flex: 1 }}><Field label="Harga" keyboardType="number-pad" value={harga} onChangeText={setHarga} testID="service-harga" /></View>
            <View style={{ flex: 1 }}><Field label="Estimasi (jam)" keyboardType="number-pad" value={estimasi} onChangeText={setEstimasi} testID="service-estimasi" /></View>
          </View>
          <Button title="Simpan" onPress={save} loading={saving} testID="service-save" />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SP.sm },
  ic: { padding: 4 },
  seg: { flexDirection: "row", backgroundColor: C.panel2, borderRadius: R.md, padding: 4, gap: 4 },
  segItem: { flex: 1, paddingVertical: 10, borderRadius: R.sm, alignItems: "center" },
});
