import { useCallback, useEffect, useState } from "react";
import { View, ScrollView, StyleSheet, ActivityIndicator, Pressable } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { AppText, Card, Button } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { rupiah, rpRaw, tglJamID } from "@/src/format";
import { C, SP, R, F } from "@/src/theme";
import { bluetoothAvailable, listBondedPrinters, printBluetooth, shareReceiptPDF, BtDevice } from "@/src/printer";

export default function Receipt() {
  const { id, print } = useLocalSearchParams<{ id: string; print?: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [printers, setPrinters] = useState<BtDevice[]>([]);
  const [selMac, setSelMac] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      setOrder(await api.get(`/orders/${id}`));
    } catch (e: any) {
      setMsg(e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => { load(); }, [load]);

  const scanPrinters = async () => {
    setMsg("");
    try {
      const list = await listBondedPrinters();
      setPrinters(list);
      if (list.length) setSelMac(list[0].address);
      if (!list.length) setMsg("Tidak ada printer ter-pair. Pair dulu di Setelan Bluetooth HP.");
    } catch (e: any) {
      setMsg(e.message);
    }
  };

  const doBluetooth = async () => {
    if (!selMac) { setMsg("Pilih printer dulu (ketuk Cari Printer)."); return; }
    setBusy(true); setMsg("");
    try {
      await printBluetooth(order, selMac);
      setMsg("✓ Nota terkirim ke printer.");
    } catch (e: any) {
      setMsg(e.message);
    } finally { setBusy(false); }
  };

  const doShare = async () => {
    setBusy(true); setMsg("");
    try { await shareReceiptPDF(order); } catch (e: any) { setMsg(e.message); } finally { setBusy(false); }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <Header title="Nota" back onBack={() => router.back()} />
        <View style={styles.center}><ActivityIndicator color={C.brand} /></View>
      </View>
    );
  }

  if (!order) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <Header title="Nota" back onBack={() => router.back()} />
        <View style={styles.center}><AppText style={{ color: C.danger }}>{msg || "Pesanan tidak ditemukan"}</AppText></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Nota Laundry" subtitle={order.nomor_invoice} back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SP.lg, paddingBottom: insets.bottom + SP.xxl, gap: SP.lg }}>
        {/* Thermal preview */}
        <View style={styles.paper}>
          <AppText style={[styles.t, styles.center2, { fontSize: 15 }]} weight="bold">HANUM LAUNDRY</AppText>
          <AppText style={[styles.t, styles.center2]}>Nota Laundry</AppText>
          <Dash />
          <AppText style={styles.t}>No   : {order.nomor_invoice}</AppText>
          <AppText style={styles.t}>Lacak: {order.kode_tracking}</AppText>
          <AppText style={styles.t}>Tgl  : {tglJamID(order.created_at)}</AppText>
          <AppText style={styles.t}>Nama : {order.pelanggan_nama}</AppText>
          <AppText style={styles.t}>Kasir: {order.kasir_nama}</AppText>
          <Dash />
          {(order.items || []).map((it: any, i: number) => (
            <View key={i} style={{ marginBottom: 2 }}>
              <AppText style={styles.t}>{it.nama_layanan}</AppText>
              <View style={styles.tline}>
                <AppText style={styles.t}>  {it.qty}{it.satuan} x {rpRaw(it.harga)}</AppText>
                <AppText style={styles.t}>{rpRaw(it.subtotal)}</AppText>
              </View>
            </View>
          ))}
          <Dash />
          <View style={styles.tline}><AppText style={styles.t}>Subtotal</AppText><AppText style={styles.t}>{rpRaw(order.subtotal)}</AppText></View>
          {order.diskon_nominal > 0 && <View style={styles.tline}><AppText style={styles.t}>Diskon ({order.diskon}%)</AppText><AppText style={styles.t}>-{rpRaw(order.diskon_nominal)}</AppText></View>}
          <View style={styles.tline}><AppText style={styles.t} weight="bold">TOTAL</AppText><AppText style={styles.t} weight="bold">{rpRaw(order.total)}</AppText></View>
          <AppText style={styles.t}>Bayar: {order.status_bayar === "lunas" ? "LUNAS" : "BELUM BAYAR"} ({order.metode_bayar})</AppText>
          <Dash />
          <AppText style={[styles.t, styles.center2]}>Terima kasih</AppText>
          <AppText style={[styles.t, styles.center2]}>Bersih - Wangi - Rapi</AppText>
        </View>

        {/* Print actions */}
        <Card style={{ gap: SP.sm }}>
          <AppText weight="bold" style={{ fontSize: 15 }}>Cetak ke Printer Bluetooth</AppText>
          <AppText style={{ color: C.muted, fontSize: 12 }}>Printer thermal 58mm (ESC/POS). Pair dulu di Setelan Bluetooth HP. Fitur ini aktif di APK hasil build.</AppText>
          <Button title="Cari Printer Ter-pair" variant="outline" icon="bluetooth" onPress={scanPrinters} testID="scan-printers" />
          {printers.map((p) => (
            <Pressable key={p.address} onPress={() => setSelMac(p.address)} style={[styles.printerRow, selMac === p.address && { borderColor: C.brand, backgroundColor: C.brandTint }]} testID={`printer-${p.address}`}>
              <Ionicons name="print" size={18} color={selMac === p.address ? C.brand : C.muted} />
              <AppText style={{ flex: 1 }}>{p.name}</AppText>
              {selMac === p.address && <Ionicons name="checkmark-circle" size={18} color={C.brand} />}
            </Pressable>
          ))}
          <Button title="Cetak ke Printer" icon="print" onPress={doBluetooth} loading={busy} testID="print-bluetooth" />
          <Button title="Bagikan / Simpan PDF" variant="outline" icon="share-outline" onPress={doShare} loading={busy} testID="share-pdf" />
          {msg ? <AppText style={{ color: msg.startsWith("✓") ? C.success : C.danger, fontSize: 13 }} testID="receipt-msg">{msg}</AppText> : null}
          {!bluetoothAvailable() && (
            <AppText style={{ color: C.warning, fontSize: 12 }}>Catatan: Bluetooth hanya tersedia di APK hasil build, bukan di preview/Expo Go. Gunakan "Bagikan PDF" untuk pratinjau.</AppText>
          )}
        </Card>
      </ScrollView>
    </View>
  );
}

function Dash() {
  return <AppText style={[styles.t, { color: C.muted }]}>--------------------------------</AppText>;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  center2: { textAlign: "center" },
  paper: { backgroundColor: "#fff", borderRadius: R.md, padding: SP.lg, borderWidth: 1, borderColor: C.border, alignSelf: "center", width: 280 },
  t: { fontFamily: F.mono, fontSize: 12, color: "#000", lineHeight: 18 },
  tline: { flexDirection: "row", justifyContent: "space-between" },
  printerRow: { flexDirection: "row", alignItems: "center", gap: SP.sm, padding: SP.md, borderRadius: R.md, borderWidth: 1, borderColor: C.border },
});
