// Receipt printing. Two paths:
//  1) Bluetooth ESC/POS (58mm) — only works in a native build (NOT Expo Go / web).
//  2) PDF/HTML share — works everywhere as a fallback.
import { Platform } from "react-native";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { buildEscPos, ReceiptOrder } from "@/src/escpos";
import { rupiah, rpRaw, tglJamID } from "@/src/format";

export type BtDevice = { name: string; address: string };

// Lazily resolve the native bluetooth module. Returns null in Expo Go / web.
function getBT(): any | null {
  if (Platform.OS !== "android") return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require("react-native-bluetooth-classic");
    return mod?.default || mod || null;
  } catch {
    return null;
  }
}

export function bluetoothAvailable(): boolean {
  return getBT() != null;
}

export async function listBondedPrinters(): Promise<BtDevice[]> {
  const BT = getBT();
  if (!BT) throw new Error("Bluetooth hanya tersedia di APK hasil build (bukan preview).");
  const enabled = await BT.isBluetoothEnabled();
  if (!enabled) {
    try {
      await BT.requestBluetoothEnabled();
    } catch {}
  }
  const devices = await BT.getBondedDevices();
  return (devices || []).map((d: any) => ({ name: d.name || d.address, address: d.address }));
}

export async function printBluetooth(order: ReceiptOrder, address: string): Promise<void> {
  const BT = getBT();
  if (!BT) throw new Error("Bluetooth hanya tersedia di APK hasil build (bukan preview).");
  let device: any;
  const connected = await BT.getConnectedDevices().catch(() => []);
  const already = (connected || []).find((d: any) => d.address === address);
  if (already) {
    device = already;
  } else {
    device = await BT.connectToDevice(address, { delimiter: "" });
  }
  const bytes = buildEscPos(order);
  // bluetooth-classic writes base64 by default
  const base64 = bytesToBase64(bytes);
  await device.write(base64, "base64");
}

function bytesToBase64(bytes: number[]): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  let result = "";
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    result += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + chars[n & 63];
  }
  if (bytes.length - i === 1) {
    const n = bytes[i] << 16;
    result += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + "==";
  } else if (bytes.length - i === 2) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8);
    result += chars[(n >> 18) & 63] + chars[(n >> 12) & 63] + chars[(n >> 6) & 63] + "=";
  }
  return result;
}

export function buildReceiptHTML(order: ReceiptOrder): string {
  const rows = (order.items || [])
    .map(
      (it) =>
        `<tr><td>${it.nama_layanan}<br/><span class="m">${it.qty}${it.satuan || ""} x ${rpRaw(it.harga)}</span></td><td class="r">${rpRaw(it.subtotal)}</td></tr>`
    )
    .join("");
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
  <style>
    @page { size: 58mm auto; margin: 0; }
    body { width: 58mm; margin: 0; padding: 6px 8px; font-family: monospace; font-size: 11px; color:#000; }
    h1 { text-align:center; font-size: 16px; margin: 4px 0; }
    .c { text-align:center; }
    .r { text-align:right; }
    .m { color:#444; font-size:10px; }
    table { width:100%; border-collapse: collapse; }
    td { padding: 1px 0; vertical-align: top; }
    hr { border: none; border-top: 1px dashed #000; margin: 4px 0; }
  </style></head><body>
    <h1>HANUM LAUNDRY</h1>
    <div class="c">Nota Laundry</div>
    <hr/>
    No&nbsp;&nbsp;&nbsp;: ${order.nomor_invoice || "-"}<br/>
    Lacak: ${order.kode_tracking || "-"}<br/>
    Tgl&nbsp;&nbsp;: ${tglJamID(order.created_at)}<br/>
    Nama&nbsp;: ${order.pelanggan_nama || "-"}<br/>
    Kasir: ${order.kasir_nama || "-"}
    <hr/>
    <table>${rows}</table>
    <hr/>
    <table>
      <tr><td>Subtotal</td><td class="r">${rpRaw(order.subtotal)}</td></tr>
      ${(order.diskon_nominal || 0) > 0 ? `<tr><td>Diskon (${order.diskon}%)</td><td class="r">-${rpRaw(order.diskon_nominal)}</td></tr>` : ""}
      <tr><td><b>TOTAL</b></td><td class="r"><b>${rupiah(order.total)}</b></td></tr>
    </table>
    Bayar: ${order.status_bayar === "lunas" ? "LUNAS" : "BELUM BAYAR"} (${order.metode_bayar || "-"})
    ${order.catatan ? `<hr/>Catatan: ${order.catatan}` : ""}
    <hr/>
    <div class="c">Terima kasih<br/>Bersih - Wangi - Rapi</div>
  </body></html>`;
}

export async function shareReceiptPDF(order: ReceiptOrder): Promise<void> {
  const html = buildReceiptHTML(order);
  const { uri } = await Print.printToFileAsync({ html });
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: "application/pdf", dialogTitle: "Nota " + (order.nomor_invoice || "") });
  }
}

export async function printSystem(order: ReceiptOrder): Promise<void> {
  await Print.printAsync({ html: buildReceiptHTML(order) });
}
