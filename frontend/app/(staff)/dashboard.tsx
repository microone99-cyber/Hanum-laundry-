import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, RefreshControl, Pressable, ActivityIndicator } from "react-native";
import { useRouter } from "expo-router";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, RolePill, StatusPill } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { rupiah } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

const STATS: { key: string; label: string; icon: keyof typeof Ionicons.glyphMap; money?: boolean; color: string }[] = [
  { key: "omzet_hari", label: "Omzet hari ini", icon: "cash", money: true, color: C.success },
  { key: "omzet_bulan", label: "Omzet bulan ini", icon: "calendar", money: true, color: C.brand },
  { key: "omzet_tahun", label: "Omzet tahun ini", icon: "trending-up", money: true, color: C.accent },
  { key: "order_hari", label: "Order hari ini", icon: "basket", color: C.warning },
  { key: "total_order", label: "Total order", icon: "cube", color: C.role_owner },
  { key: "belum_bayar", label: "Belum dibayar", icon: "alert-circle", money: true, color: C.danger },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api.get("/dashboard");
      setData(d);
    } catch (e) {
      // ignore
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header
        title={`Halo, ${user?.nama?.split(" ")[0] || "Staf"}`}
        subtitle="Ringkasan bisnis laundry"
        right={
          <View style={{ flexDirection: "row", alignItems: "center", gap: SP.sm }}>
            {user && <RolePill role={user.role} />}
            <Pressable onPress={logout} hitSlop={8} testID="logout-button">
              <Ionicons name="log-out-outline" size={24} color={C.danger} />
            </Pressable>
          </View>
        }
      />
      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.brand} /></View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: SP.lg, paddingBottom: SP.xxl }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={() => { setRefreshing(true); load(); }} tintColor={C.brand} />}
        >
          <View style={styles.grid}>
            {STATS.map((s) => (
              <Card key={s.key} style={styles.statCard} testID={`stat-${s.key}`}>
                <View style={[styles.statIcon, { backgroundColor: s.color + "1A" }]}>
                  <Ionicons name={s.icon} size={18} color={s.color} />
                </View>
                <AppText style={{ color: C.muted, fontSize: 12, marginTop: SP.sm }}>{s.label}</AppText>
                <AppText weight="extrabold" style={{ fontSize: s.money ? 17 : 22, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>
                  {s.money ? rupiah(data?.[s.key]) : data?.[s.key] ?? 0}
                </AppText>
              </Card>
            ))}
          </View>

          {data?.top_customers?.length > 0 && (
            <Card style={{ marginTop: SP.lg }}>
              <AppText weight="bold" style={{ fontSize: 16, marginBottom: SP.sm }}>Pelanggan Teratas</AppText>
              {data.top_customers.map((c: any, i: number) => (
                <View key={i} style={styles.topRow}>
                  <View style={{ flexDirection: "row", alignItems: "center", gap: SP.sm, flex: 1 }}>
                    <View style={styles.rank}><AppText weight="bold" style={{ color: C.brand, fontSize: 12 }}>{i + 1}</AppText></View>
                    <AppText weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{c.nama}</AppText>
                  </View>
                  <AppText weight="bold" style={{ color: C.success }}>{rupiah(c.total)}</AppText>
                </View>
              ))}
            </Card>
          )}

          <Card style={{ marginTop: SP.lg }}>
            <AppText weight="bold" style={{ fontSize: 16, marginBottom: SP.sm }}>Pesanan Terbaru</AppText>
            {(!data?.recent || data.recent.length === 0) ? (
              <AppText style={{ color: C.muted, paddingVertical: SP.md }}>Belum ada pesanan.</AppText>
            ) : (
              data.recent.map((o: any) => (
                <Pressable key={o.id} style={styles.recentRow} onPress={() => router.push(`/receipt/${o.id}`)} testID={`recent-order-${o.id}`}>
                  <View style={{ flex: 1 }}>
                    <AppText weight="semibold" style={{ fontFamily: F.mono, fontSize: 13 }}>{o.nomor_invoice}</AppText>
                    <AppText style={{ color: C.muted, fontSize: 13 }} numberOfLines={1}>{o.pelanggan_nama}</AppText>
                  </View>
                  <View style={{ alignItems: "flex-end", gap: 4 }}>
                    <AppText weight="bold">{rupiah(o.total)}</AppText>
                    <StatusPill status={o.status} />
                  </View>
                </Pressable>
              ))
            )}
          </Card>
        </ScrollView>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: SP.md },
  statCard: { width: "47.8%", padding: SP.md },
  statIcon: { width: 34, height: 34, borderRadius: 10, alignItems: "center", justifyContent: "center" },
  topRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 7, borderTopWidth: 1, borderTopColor: C.border },
  rank: { width: 22, height: 22, borderRadius: 11, backgroundColor: C.brandTint, alignItems: "center", justifyContent: "center" },
  recentRow: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingVertical: 10, borderTopWidth: 1, borderTopColor: C.border, gap: SP.sm },
});
