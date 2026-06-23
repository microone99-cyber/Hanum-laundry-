import { useCallback, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator, ScrollView } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, Chip, StatusPill, EmptyState } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglJamID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

const FILTERS = [
  { v: "", l: "Semua" },
  { v: "proses", l: "Proses" },
  { v: "siap", l: "Siap" },
  { v: "selesai", l: "Selesai" },
  { v: "batal", l: "Dibatalkan" },
];

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === "owner";
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [berat, setBerat] = useState("");
  const [hargaKg, setHargaKg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setList(await api.get("/orders"));
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const openDetail = (o: any) => {
    setSel(o);
    setBerat(o.items?.[0]?.qty ? String(o.items[0].qty) : "");
    setHargaKg(o.items?.[0]?.harga ? String(o.items[0].harga) : "");
  };

  const act = async (fn: () => Promise<any>) => {
    setBusy(true);
    try {
      await fn();
      const fresh = await api.get(`/orders/${sel.id}`);
      setSel(fresh);
      load();
    } finally {
      setBusy(false);
    }
  };

  const setStatus = (status: string) => act(() => api.put(`/orders/${sel.id}`, { status }));
  const setBayar = (status_bayar: string) => act(() => api.put(`/orders/${sel.id}`, { status_bayar }));
  const timbang = () =>
    act(() =>
      api.put(`/orders/${sel.id}`, {
        items: [{ ...sel.items[0], qty: parseFloat(berat.replace(",", ".")) || 0, harga: parseInt(hargaKg) || 0 }],
        diskon: sel.diskon || 0,
      })
    );
  const cancel = () => act(() => api.post(`/orders/${sel.id}/cancel`));
  const hapus = async () => { await api.del(`/orders/${sel.id}`); setSel(null); load(); };

  const filtered = list.filter((o) => {
    const okF = !filter || o.status === filter;
    const okQ = !q || o.nomor_invoice?.toLowerCase().includes(q.toLowerCase()) || o.pelanggan_nama?.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Daftar Pesanan" subtitle={`${list.length} total`} />
      <View style={styles.toolbar}>
        <Field placeholder="Cari invoice / nama" value={q} onChangeText={setQ} testID="orders-search" />
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: SP.sm, paddingVertical: SP.sm }}>
          {FILTERS.map((f) => <Chip key={f.v} label={f.l} active={filter === f.v} onPress={() => setFilter(f.v)} testID={`filter-${f.v || "all"}`} />)}
        </ScrollView>
      </View>

      {loading ? (
        <View style={styles.center}><ActivityIndicator color={C.brand} /></View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(o) => o.id}
          contentContainerStyle={{ padding: SP.lg, paddingTop: SP.sm, paddingBottom: SP.xxl, gap: SP.sm }}
          ListEmptyComponent={<EmptyState icon="receipt-outline" title="Belum ada pesanan" subtitle="Buat pesanan baru di tab Order Baru" />}
          renderItem={({ item }) => (
            <Pressable onPress={() => openDetail(item)} testID={`order-${item.id}`}>
              <Card>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
                  <AppText weight="bold" style={{ fontFamily: F.mono, fontSize: 14 }}>{item.nomor_invoice}</AppText>
                  <StatusPill status={item.status} />
                </View>
                <AppText style={{ color: C.muted, fontSize: 12, marginTop: 2 }}>{tglJamID(item.created_at)}</AppText>
                <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-end", marginTop: SP.sm }}>
                  <AppText weight="semibold" numberOfLines={1} style={{ flex: 1 }}>{item.pelanggan_nama}</AppText>
                  <View style={{ alignItems: "flex-end" }}>
                    <AppText weight="bold">{item.perlu_timbang ? "Perlu timbang" : rupiah(item.total)}</AppText>
                    <AppText weight="semibold" style={{ fontSize: 12, color: item.status_bayar === "lunas" ? C.success : C.danger }}>
                      {item.status_bayar === "lunas" ? "Lunas" : "Belum bayar"}
                    </AppText>
                  </View>
                </View>
              </Card>
            </Pressable>
          )}
        />
      )}

      <Sheet visible={!!sel} onClose={() => setSel(null)} title={sel?.nomor_invoice || "Pesanan"} testID="order-detail-sheet">
        {sel && (
          <View style={{ gap: SP.md }}>
            <Card style={{ gap: 6 }}>
              <Row k="Pelanggan" v={sel.pelanggan_nama} />
              <Row k="Kode lacak" v={sel.kode_tracking} mono />
              <Row k="Tanggal" v={tglJamID(sel.created_at)} />
              <Row k="Kasir" v={sel.kasir_nama} />
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              {(sel.items || []).map((it: any, idx: number) => (
                <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ flex: 1 }}>{it.nama_layanan} ({it.qty}{it.satuan})</AppText>
                  <AppText weight="semibold">{rupiah(it.subtotal)}</AppText>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row k="Total" v={rupiah(sel.total)} bold />
            </Card>

            {sel.perlu_timbang && sel.status !== "batal" && (
              <Card style={{ gap: SP.sm }}>
                <AppText weight="bold">Timbang & Set Harga</AppText>
                <Field label="Berat (kg)" keyboardType="decimal-pad" value={berat} onChangeText={setBerat} testID="timbang-berat" />
                <Field label="Harga / kg" keyboardType="number-pad" value={hargaKg} onChangeText={setHargaKg} testID="timbang-harga" />
                <Button title="Simpan Timbangan" onPress={timbang} loading={busy} testID="timbang-save" />
              </Card>
            )}

            {sel.status !== "batal" && (
              <>
                <View style={styles.actGrid}>
                  <Button title="Proses" variant={sel.status === "proses" ? "primary" : "outline"} onPress={() => setStatus("proses")} style={styles.actBtn} testID="set-proses" />
                  <Button title="Siap" variant={sel.status === "siap" ? "primary" : "outline"} onPress={() => setStatus("siap")} style={styles.actBtn} testID="set-siap" />
                  <Button title="Selesai" variant={sel.status === "selesai" ? "success" : "outline"} onPress={() => setStatus("selesai")} style={styles.actBtn} testID="set-selesai" />
                </View>
                <Button
                  title={sel.status_bayar === "lunas" ? "Tandai Belum Bayar" : "Tandai Lunas"}
                  variant={sel.status_bayar === "lunas" ? "outline" : "success"}
                  icon="cash-outline"
                  onPress={() => setBayar(sel.status_bayar === "lunas" ? "belum" : "lunas")}
                  testID="toggle-bayar"
                />
              </>
            )}

            <Button title="Cetak Nota" icon="print" onPress={() => { const id = sel.id; setSel(null); router.push(`/receipt/${id}`); }} testID="detail-print" />

            {sel.status !== "batal" && (
              <Button title="Batalkan Pesanan" variant="danger" icon="close-circle-outline" onPress={cancel} loading={busy} testID="detail-cancel" />
            )}
            {isOwner && (
              <Button title="Hapus Permanen" variant="outline" icon="trash-outline" onPress={hapus} style={{ borderColor: C.danger }} testID="detail-delete" />
            )}
          </View>
        )}
      </Sheet>
    </View>
  );
}

function Row({ k, v, bold, mono }: { k: string; v: string; bold?: boolean; mono?: boolean }) {
  return (
    <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
      <AppText style={{ color: C.muted }}>{k}</AppText>
      <AppText weight={bold ? "bold" : "semibold"} style={mono ? { fontFamily: F.mono } : undefined}>{v}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  toolbar: { paddingHorizontal: SP.lg, paddingTop: SP.sm, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: SP.xs },
  actGrid: { flexDirection: "row", gap: SP.sm },
  actBtn: { flex: 1, paddingHorizontal: 4 },
});
