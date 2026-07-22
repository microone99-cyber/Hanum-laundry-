import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { C, SP, R } from "@/src/theme";

export default function Customers() {
  const { user } = useAuth();
  const canDelete = user && ["owner", "admin"].includes(user.role);
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [sheet, setSheet] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [alamat, setAlamat] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.get("/customers"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openNew = () => {
    setEditing(null); setNama(""); setTelepon(""); setAlamat(""); setSheet(true);
  };
  const openEdit = (c: any) => {
    setEditing(c); setNama(c.nama); setTelepon(c.telepon || ""); setAlamat(c.alamat || ""); setSheet(true);
  };

  const save = async () => {
    if (!nama.trim()) return;
    setSaving(true);
    try {
      const body = { nama: nama.trim(), telepon: telepon.trim(), alamat: alamat.trim() };
      if (editing) await api.put(`/customers/${editing.id}`, body);
      else await api.post("/customers", body);
      setSheet(false);
      load();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    await api.del(`/customers/${id}`);
    load();
  };

  const filtered = list.filter((c) => c.nama.toLowerCase().includes(q.toLowerCase()) || (c.telepon || "").includes(q));

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header
        title="Pelanggan"
        subtitle={`${list.length} pelanggan`}
        right={<Pressable onPress={openNew} style={styles.addBtn} testID="add-customer-button"><Ionicons name="add" size={22} color="#fff" /></Pressable>}
      />
      <View style={{ padding: SP.lg, paddingBottom: SP.sm }}>
        <Field placeholder="Cari nama / nomor HP" value={q} onChangeText={setQ} testID="customer-search" />
      </View>
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.brand} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(c) => c.id}
          contentContainerStyle={{ paddingHorizontal: SP.lg, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Belum ada pelanggan" subtitle="Tambah pelanggan dengan tombol +" />}
          renderItem={({ item }) => (
            <Card style={styles.row} testID={`customer-${item.id}`}>
              <View style={styles.avatar}><AppText weight="bold" style={{ color: C.brand }}>{item.nama[0]?.toUpperCase()}</AppText></View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" numberOfLines={1}>{item.nama}</AppText>
                <AppText style={{ color: C.muted, fontSize: 13 }}>{item.telepon || "Tanpa nomor"}</AppText>
              </View>
              <Pressable onPress={() => openEdit(item)} hitSlop={8} style={styles.iconBtn} testID={`edit-customer-${item.id}`}>
                <Ionicons name="create-outline" size={20} color={C.brand} />
              </Pressable>
              {canDelete && (
                <Pressable onPress={() => remove(item.id)} hitSlop={8} style={styles.iconBtn} testID={`delete-customer-${item.id}`}>
                  <Ionicons name="trash-outline" size={20} color={C.danger} />
                </Pressable>
              )}
            </Card>
          )}
        />
      )}

      <Sheet visible={sheet} onClose={() => setSheet(false)} title={editing ? "Edit Pelanggan" : "Pelanggan Baru"} testID="customer-sheet">
        <View style={{ gap: SP.md }}>
          <Field label="Nama" value={nama} onChangeText={setNama} testID="customer-nama-input" />
          <Field label="No. HP" keyboardType="phone-pad" value={telepon} onChangeText={setTelepon} testID="customer-telepon-input" />
          <Field label="Alamat" value={alamat} onChangeText={setAlamat} multiline testID="customer-alamat-input" />
          <Button title="Simpan" onPress={save} loading={saving} testID="customer-save-button" />
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  addBtn: { width: 38, height: 38, borderRadius: 12, backgroundColor: C.brand, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md, padding: SP.md },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: C.brandTint, alignItems: "center", justifyContent: "center" },
  iconBtn: { padding: 4 },
});
