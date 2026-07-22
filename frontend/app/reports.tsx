import { useCallback, useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { api } from "@/src/api";
import { AppText, Card, Chip } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { rupiah, tglID } from "@/src/format";
import { C, SP } from "@/src/theme";

function rangeFor(preset: string): { dari: string; sampai: string } {
  const now = new Date();
  const end = now.toISOString();
  if (preset === "hari") return { dari: new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString(), sampai: end };
  if (preset === "minggu") { const d = new Date(now); d.setDate(d.getDate() - 6); return { dari: d.toISOString(), sampai: end }; }
  if (preset === "tahun") return { dari: new Date(now.getFullYear(), 0, 1).toISOString(), sampai: end };
  return { dari: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(), sampai: end };
}

export default function Reports() {
  const router = useRouter();
  const [preset, setPreset] = useState("bulan");
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async (p: string) => {
    setLoading(true);
    try {
      const r = rangeFor(p);
      setData(await api.get(`/reports?dari=${encodeURIComponent(r.dari)}&sampai=${encodeURIComponent(r.sampai)}`));
    } finally { setLoading(false); }
  }, []);

  useFocusEffect(useCallback(() => { load(preset); }, [load, preset]));

  const STATS = [
    { l: "Omzet", k: "omzet", c: C.success },
    { l: "Pengeluaran", k: "pengeluaran", c: C.danger },
    { l: "Laba bersih", k: "laba", c: C.brand },
    { l: "Belum dibayar", k: "belum_bayar", c: C.warning },
  ];

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Laporan" subtitle="Omzet, pengeluaran & laba" back onBack={() => router.back()} />
      <View style={{ paddingHorizontal: SP.lg, paddingTop: SP.sm }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.sm }}>
          {[["hari", "Hari ini"], ["minggu", "7 Hari"], ["bulan", "Bulan ini"], ["tahun", "Tahun ini"]].map(([v, l]) => (
            <Chip key={v} label={l} active={preset === v} onPress={() => setPreset(v)} testID={`report-${v}`} />
          ))}
        </ScrollView>
      </View>
      {loading ? <View style={styles.center}><ActivityIndicator color={C.brand} /></View> : (
        <ScrollView contentContainerStyle={{ padding: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xxl, gap: SP.md }}>
          <View style={styles.grid}>
            {STATS.map((s) => (
              <Card key={s.k} style={styles.statCard} testID={`report-stat-${s.k}`}>
                <AppText style={{ color: C.muted, fontSize: 12 }}>{s.l}</AppText>
                <AppText weight="extrabold" style={{ fontSize: 17, color: s.c, marginTop: 2 }} numberOfLines={1} adjustsFontSizeToFit>{rupiah(data?.[s.k])}</AppText>
              </Card>
            ))}
          </View>
          <Card>
            <AppText weight="bold" style={{ fontSize: 16, marginBottom: SP.sm }}>Rincian Harian</AppText>
            {(!data?.breakdown || data.breakdown.length === 0) ? (
              <AppText style={{ color: C.muted, paddingVertical: SP.sm }}>Tidak ada data pada periode ini.</AppText>
            ) : (
              <>
                <View style={[styles.brow, { borderTopWidth: 0 }]}>
                  <AppText weight="semibold" style={{ flex: 1.4, color: C.muted, fontSize: 12 }}>Tanggal</AppText>
                  <AppText weight="semibold" style={{ flex: 1, color: C.muted, fontSize: 12, textAlign: "right" }}>Omzet</AppText>
                  <AppText weight="semibold" style={{ flex: 1, color: C.muted, fontSize: 12, textAlign: "right" }}>Laba</AppText>
                </View>
                {data.breakdown.map((b: any) => (
                  <View key={b.tanggal} style={styles.brow}>
                    <AppText style={{ flex: 1.4, fontSize: 13 }}>{tglID(b.tanggal)}</AppText>
                    <AppText style={{ flex: 1, fontSize: 13, textAlign: "right" }}>{rupiah(b.omzet)}</AppText>
                    <AppText weight="semibold" style={{ flex: 1, fontSize: 13, textAlign: "right", color: b.laba >= 0 ? C.success : C.danger }}>{rupiah(b.laba)}</AppText>
                  </View>
                ))}
              </>
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
  statCard: { width: "47.8%" },
  brow: { flexDirection: "row", alignItems: "center", paddingVertical: 8, borderTopWidth: 1, borderTopColor: C.border },
});
