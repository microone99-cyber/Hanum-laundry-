import { View, ScrollView, StyleSheet, Pressable } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { AppText, Card, RolePill, Button } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { C, SP, R } from "@/src/theme";

type Item = { label: string; sub: string; icon: keyof typeof Ionicons.glyphMap; route: string; color: string; roles?: string[] };

const ITEMS: Item[] = [
  { label: "Pengeluaran", sub: "Biaya operasional", icon: "wallet", route: "/expenses", color: C.danger },
  { label: "Kas / Laci", sub: "Buku kas masuk & keluar", icon: "cash", route: "/cash", color: C.success },
  { label: "Laporan", sub: "Omzet, pengeluaran, laba", icon: "bar-chart", route: "/reports", color: C.brand, roles: ["owner", "admin"] },
  { label: "Layanan & Tarif", sub: "Kelola paket & harga", icon: "pricetags", route: "/services-manage", color: C.accent, roles: ["owner", "admin"] },
  { label: "Pengguna", sub: "Kelola peran akun", icon: "key", route: "/users", color: C.role_owner, roles: ["owner", "admin"] },
];

export default function More() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const items = ITEMS.filter((i) => !i.roles || (user && i.roles.includes(user.role)));

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Lainnya" subtitle="Menu & pengaturan" />
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl, gap: SP.md }}>
        <Card style={styles.profile}>
          <View style={styles.avatar}><Ionicons name="person" size={26} color="#fff" /></View>
          <View style={{ flex: 1 }}>
            <AppText weight="bold" style={{ fontSize: 16 }}>{user?.nama}</AppText>
            <AppText style={{ color: C.muted, fontSize: 13 }}>{user?.email}</AppText>
          </View>
          {user && <RolePill role={user.role} />}
        </Card>

        {items.map((it) => (
          <Pressable key={it.route} onPress={() => router.push(it.route as any)} testID={`menu-${it.route.replace("/", "")}`}>
            <Card style={styles.menuRow}>
              <View style={[styles.menuIcon, { backgroundColor: it.color + "1A" }]}>
                <Ionicons name={it.icon} size={20} color={it.color} />
              </View>
              <View style={{ flex: 1 }}>
                <AppText weight="semibold" style={{ fontSize: 15 }}>{it.label}</AppText>
                <AppText style={{ color: C.muted, fontSize: 13 }}>{it.sub}</AppText>
              </View>
              <Ionicons name="chevron-forward" size={20} color={C.muted} />
            </Card>
          </Pressable>
        ))}

        <View style={{ height: SP.sm }} />
        <Button title="Keluar" variant="outline" icon="log-out-outline" onPress={logout} testID="more-logout-button" />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  profile: { flexDirection: "row", alignItems: "center", gap: SP.md },
  avatar: { width: 48, height: 48, borderRadius: 24, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  menuRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: SP.md },
  menuIcon: { width: 42, height: 42, borderRadius: 12, alignItems: "center", justifyContent: "center" },
});
