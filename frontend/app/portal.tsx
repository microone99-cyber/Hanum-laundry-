import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator } from "react-native";
import { Redirect, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, StatusPill, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

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

  const claim = async () => {
    if (!kode.trim()) return;
    setBusy(true); setMsg("");
    try {
      const r = await api.post("/orders/claim", { kode: kode.trim() });
      setMsg(`✓ Berhasil klaim: ${r.nomor_invoice}`);
      setKode(""); load();
    } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  const pesan = async (s: any) => {
    setBusy(true);
    try {
      await api.post("/orders/customer", { paket: s.nama, harga: s.harga, catatan: "" });
      setOrderSheet(false); load();
    } finally { setBusy(false); }
  };

  const cancel = async (id: string) => { await api.post(`/orders/${id}/cancel`); load(); };

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Laundry Saya" subtitle={user.nama}
        right={<Pressable onPress={logout} hitSlop={8} testID="portal-logout"><Ionicons name="log-out-outline" size={24} color={C.danger} /></Pressable>} />
      <View style={{ flexDirection: "row", gap: SP.sm, padding: SP.lg, paddingBottom: SP.sm }}>
        <Button title="Klaim Nota" variant="outline" icon="ticket-outline" onPress={() => { setMsg(""); setClaimSheet(true); }} style={{ flex: 1 }} testID="open-claim" />
        <Button title="Pesan Laundry" icon="add" onPress={() => setOrderSheet(true)} style={{ flex: 1 }} testID="open-pesan" />
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

      <Sheet visible={claimSheet} onClose={() => setClaimSheet(false)} title="Klaim Pesanan" testID="claim-sheet">
        <View style={{ gap: SP.md }}>
          <AppText style={{ color: C.muted }}>Masukkan kode nota (tercetak di struk laundry Anda).</AppText>
          <Field label="Kode nota" autoCapitalize="none" value={kode} onChangeText={setKode} testID="claim-kode" />
          {msg ? <AppText style={{ color: msg.startsWith("✓") ? C.success : C.danger }} testID="claim-msg">{msg}</AppText> : null}
          <Button title="Klaim" onPress={claim} loading={busy} testID="claim-submit" />
        </View>
      </Sheet>

      <Sheet visible={orderSheet} onClose={() => setOrderSheet(false)} title="Pesan Laundry" testID="pesan-sheet">
        <View style={{ gap: SP.sm }}>
          <AppText style={{ color: C.muted, marginBottom: SP.xs }}>Pilih paket. Total dihitung petugas saat ditimbang.</AppText>
          {services.map((s) => (
            <Pressable key={s.id} onPress={() => pesan(s)} disabled={busy} testID={`pesan-${s.id}`}>
              <Card style={styles.svcRow}>
                <View style={{ flex: 1 }}>
                  <AppText weight="semibold">{s.nama}</AppText>
                  <AppText style={{ color: C.muted, fontSize: 13 }}>{rupiah(s.harga)} / {s.satuan}</AppText>
                </View>
                <Ionicons name="add-circle" size={24} color={C.brand} />
              </Card>
            </Pressable>
          ))}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  svcRow: { flexDirection: "row", alignItems: "center", gap: SP.md, paddingVertical: SP.md },
});
