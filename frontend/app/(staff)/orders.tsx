import { useCallback, useEffect, useRef, useState } from "react";
import { View, FlatList, StyleSheet, Pressable, ActivityIndicator, ScrollView, Linking, Platform, Vibration } from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { useAuth } from "@/src/auth";
import { AppText, Card, Button, Field, Chip, StatusPill, EmptyState, Pill } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { Sheet } from "@/src/components/Sheet";
import { rupiah, tglJamID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";

// Bunyi "ding-ding" pakai Web Audio API (nggak butuh file suara/asset apapun).
// Browser modern block audio autoplay sebelum ada interaksi user sekali —
// begitu kasir sempat tap layar sekali (buka app dsb), suara ini bakal jalan normal.
function playBeep() {
  if (Platform.OS === "web") {
    try {
      const AudioCtx = (window as any).AudioContext || (window as any).webkitAudioContext;
      const ctx = new AudioCtx();
      const ding = (freq: number, delay: number, dur: number) => {
        setTimeout(() => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = "sine";
          osc.frequency.value = freq;
          gain.gain.setValueAtTime(0.0001, ctx.currentTime);
          gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.01);
          gain.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + dur);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start();
          osc.stop(ctx.currentTime + dur);
        }, delay);
      };
      ding(880, 0, 0.4);
      ding(1175, 220, 0.35);
    } catch {}
  }
  try {
    Vibration.vibrate(Platform.OS === "ios" ? [0, 200, 100, 200] : [0, 300, 150, 300]);
  } catch {}
}

const POLL_MS = 10000;

const FILTERS = [
  { v: "", l: "Semua" },
  { v: "proses", l: "Proses" },
  { v: "siap", l: "Siap" },
  { v: "selesai", l: "Selesai" },
  { v: "batal", l: "Dibatalkan" },
];

type TimbangVal = { berat: string; harga: string };

export default function Orders() {
  const { user } = useAuth();
  const router = useRouter();
  const isOwner = user?.role === "owner";
  const [list, setList] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState("");
  const [sel, setSel] = useState<any>(null);
  const [timbangVals, setTimbangVals] = useState<Record<number, TimbangVal>>({});
  const [busy, setBusy] = useState(false);
  const [newAlert, setNewAlert] = useState<string>("");

  const seenIds = useRef<Set<string> | null>(null); // null = belum pernah load (jangan alert di load pertama)

  const load = useCallback(async (silent = false) => {
    try {
      const fresh = await api.get("/orders");
      if (seenIds.current) {
        const baruMasuk = fresh.filter((o: any) => !seenIds.current!.has(o.id));
        if (baruMasuk.length > 0) {
          playBeep();
          setNewAlert(
            baruMasuk.length === 1
              ? `🔔 Pesanan baru: ${baruMasuk[0].nomor_invoice}`
              : `🔔 ${baruMasuk.length} pesanan baru masuk`
          );
        }
      }
      seenIds.current = new Set(fresh.map((o: any) => o.id));
      setList(fresh);
    } catch {
      // silent: gagal fetch pas polling background gak perlu ganggu tampilan
      if (!silent) throw new Error("Gagal memuat pesanan");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-refresh tiap 10 detik SELAMA halaman ini kebuka di layar depan.
  // Begitu pindah tab/halaman lain, polling berhenti (biar gak boros baterai/data).
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(() => load(true), POLL_MS);
      return () => clearInterval(t);
    }, [load])
  );

  useEffect(() => {
    if (!newAlert) return;
    const t = setTimeout(() => setNewAlert(""), 5000);
    return () => clearTimeout(t);
  }, [newAlert]);

  const openDetail = (o: any) => {
    setSel(o);
    const vals: Record<number, TimbangVal> = {};
    (o.items || []).forEach((it: any, idx: number) => {
      if (it.satuan !== "pcs") {
        vals[idx] = {
          berat: it.qty ? String(it.qty) : "",
          harga: it.harga ? String(it.harga) : "",
        };
      }
    });
    setTimbangVals(vals);
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

  // Fix: dulu ini me-replace SELURUH items jadi cuma 1 item (item pertama),
  // jadi kalau pesanan punya beberapa item, sisanya hilang & total salah.
  // Sekarang: tiap item kiloan ditimbang & dihargai masing-masing per paket,
  // item pcs/satuan (yang udah pasti harganya dari awal) dibiarkan apa adanya,
  // lalu semuanya dikirim utuh biar backend jumlahin totalnya dengan benar.
  const timbang = () =>
    act(() => {
      const items = (sel.items || []).map((it: any, idx: number) => {
        const v = timbangVals[idx];
        if (it.satuan !== "pcs" && v) {
          const berat = parseFloat((v.berat || "0").replace(",", ".")) || 0;
          const harga = parseInt(v.harga || "0", 10) || 0;
          return { ...it, qty: berat, harga };
        }
        return it;
      });
      return api.put(`/orders/${sel.id}`, { items, diskon: sel.diskon || 0 });
    });

  const cancel = () => act(() => api.post(`/orders/${sel.id}/cancel`));
  const hapus = async () => { await api.del(`/orders/${sel.id}`); setSel(null); load(); };

  const chatWA = (order: any) => {
    let nomor = String(order.pelanggan_telepon || "").replace(/[^0-9]/g, "");
    if (nomor.startsWith("0")) nomor = "62" + nomor.slice(1);
    let pesan = `Halo ${order.pelanggan_nama}, ini dari Hanum Laundry terkait pesanan ${order.nomor_invoice}.`;
    if (order.butuh_jemput) pesan += `\nKami akan jemput cucian di: ${order.alamat_jemput || "(alamat belum diisi)"}.`;
    if (order.butuh_antar) pesan += `\nKami akan antar cucian ke: ${order.alamat_antar || "(alamat belum diisi)"}.`;
    pesan += `\nMohon konfirmasi waktu yang pas ya. Terima kasih.`;
    Linking.openURL(`https://wa.me/${nomor}?text=${encodeURIComponent(pesan)}`);
  };

  const filtered = list.filter((o) => {
    const okF = !filter || o.status === filter;
    const okQ = !q || o.nomor_invoice?.toLowerCase().includes(q.toLowerCase()) || o.pelanggan_nama?.toLowerCase().includes(q.toLowerCase());
    return okF && okQ;
  });

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Daftar Pesanan" subtitle={`${list.length} total`} />

      {newAlert ? (
        <Pressable onPress={() => setNewAlert("")} style={styles.alertBanner} testID="new-order-alert">
          <Ionicons name="notifications" size={18} color="#fff" />
          <AppText weight="bold" style={{ color: "#fff", flex: 1 }}>{newAlert}</AppText>
          <Ionicons name="close" size={18} color="#fff" />
        </Pressable>
      ) : null}

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
                {(item.butuh_jemput || item.butuh_antar) && (
                  <View style={{ flexDirection: "row", gap: SP.xs, marginTop: SP.xs, flexWrap: "wrap" }}>
                    {item.butuh_jemput && <Pill text="🛵 Jemput" fg={C.brand} bg="#EEF2FF" />}
                    {item.butuh_antar && <Pill text="📦 Antar" fg={C.brand} bg="#EEF2FF" />}
                  </View>
                )}
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
              {sel.butuh_jemput && <Row k="🛵 Jemput di" v={sel.alamat_jemput || "-"} />}
              {sel.butuh_antar && <Row k="📦 Antar ke" v={sel.alamat_antar || "-"} /> }
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              {(sel.items || []).map((it: any, idx: number) => (
                <View key={idx} style={{ flexDirection: "row", justifyContent: "space-between" }}>
                  <AppText style={{ flex: 1 }}>
                    {it.nama_layanan} ({it.satuan === "pcs" ? it.qty : (it.qty || 0)}{it.satuan})
                  </AppText>
                  <AppText weight="semibold">{it.satuan !== "pcs" && !it.qty ? "Belum ditimbang" : rupiah(it.subtotal)}</AppText>
                </View>
              ))}
              <View style={{ height: 1, backgroundColor: C.border, marginVertical: 4 }} />
              <Row k="Total" v={rupiah(sel.total)} bold />
            </Card>

            {sel.perlu_timbang && sel.status !== "batal" && (
              <Card style={{ gap: SP.md }}>
                <AppText weight="bold">Timbang & Set Harga</AppText>
                <AppText style={{ color: C.muted, fontSize: 12, marginTop: -SP.sm }}>
                  Item pcs/satuan sudah pasti harganya. Timbang tiap paket kiloan di bawah, nanti otomatis dijumlah ke total.
                </AppText>
                {(sel.items || []).map((it: any, idx: number) => {
                  if (it.satuan === "pcs") return null;
                  const v = timbangVals[idx] || { berat: "", harga: "" };
                  return (
                    <View key={idx} style={{ gap: SP.sm, paddingTop: SP.xs, borderTopWidth: idx > 0 ? 1 : 0, borderTopColor: C.border }}>
                      <AppText weight="semibold" style={{ fontSize: 13 }}>{it.nama_layanan}</AppText>
                      <Field
                        label="Berat (kg)"
                        keyboardType="decimal-pad"
                        value={v.berat}
                        onChangeText={(t) => setTimbangVals((old) => ({ ...old, [idx]: { ...old[idx], berat: t } }))}
                        testID={`timbang-berat-${idx}`}
                      />
                      <Field
                        label="Harga / kg"
                        keyboardType="number-pad"
                        value={v.harga}
                        onChangeText={(t) => setTimbangVals((old) => ({ ...old, [idx]: { ...old[idx], harga: t } }))}
                        testID={`timbang-harga-${idx}`}
                      />
                    </View>
                  );
                })}
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

            {(sel.butuh_jemput || sel.butuh_antar) && sel.pelanggan_telepon && (
              <Button
                title="Chat WA Pelanggan"
                icon="logo-whatsapp"
                variant="success"
                onPress={() => chatWA(sel)}
                testID="detail-chat-wa"
              />
            )}

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
  alertBanner: {
    flexDirection: "row", alignItems: "center", gap: SP.sm,
    backgroundColor: C.brand, marginHorizontal: SP.lg, marginTop: SP.sm,
    padding: SP.md, borderRadius: R.md,
  },
  toolbar: { paddingHorizontal: SP.lg, paddingTop: SP.sm, backgroundColor: C.panel, borderBottomWidth: 1, borderBottomColor: C.border, paddingBottom: SP.xs },
  actGrid: { flexDirection: "row", gap: SP.sm },
  actBtn: { flex: 1, paddingHorizontal: 4 },
});
