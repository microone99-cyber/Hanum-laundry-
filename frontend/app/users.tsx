import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, RolePill, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { C, SP, R, ROLE_LABEL, roleColor } from "@/src/theme";

const ROLES = ["owner", "admin", "kasir", "pelanggan"];

export default function Users() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === "owner";
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sel, setSel] = useState<any>(null);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try { setList(await api.get("/users")); } finally { setLoading(false); }
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const setRole = async (role: string) => {
    setBusy(true);
    try { await api.put(`/users/${sel.id}/role`, { role }); setSel(null); load(); } finally { setBusy(false); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Pengguna" subtitle={`${list.length} akun`} back onBack={() => router.back()} />
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <FlatList data={list} keyExtractor={(u) => u.id}
          contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="people-outline" title="Belum ada pengguna" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => isOwner && setSel(item)} disabled={!isOwner} testID={`user-${item.id}`}>
              <Card style={styles.row}>
                <View style={[styles.avatar, { backgroundColor: roleColor(item.role) }]}><AppText weight="bold" style={{ color: "#fff" }}>{item.nama[0]?.toUpperCase()}</AppText></View>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{item.nama}</AppText>
                  <AppText style={{ color: C.muted, fontSize: 12 }}>{item.email}</AppText>
                </View>
                <RolePill role={item.role} />
              </Card>
            </Pressable>
          )} />
      )}
      <Sheet visible={!!sel} onClose={() => setSel(null)} title={`Ubah Peran: ${sel?.nama || ""}`} testID="role-sheet">
        <View style={{ gap: SP.sm }}>
          {ROLES.map((r) => (
            <Button key={r} title={ROLE_LABEL[r]} variant={sel?.role === r ? "primary" : "outline"} onPress={() => setRole(r)} loading={busy} testID={`set-role-${r}`} />
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: SP.md },
  avatar: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
});
