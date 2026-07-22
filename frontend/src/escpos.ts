// Pure-JS ESC/POS command builder for 58mm thermal printers (32 chars/line).
import { rpRaw } from "@/src/format";

const ESC = 0x1b;
const GS = 0x1d;
const LF = 0x0a;
const LINE_WIDTH = 32;

function strBytes(s: string): number[] {
  const out: number[] = [];
  for (let i = 0; i < s.length; i++) out.push(s.charCodeAt(i) & 0xff);
  return out;
}

function textLine(s: string): number[] {
  return [...strBytes(s), LF];
}

function twoCol(left: string, right: string): string {
  const space = Math.max(1, LINE_WIDTH - left.length - right.length);
  if (left.length + right.length >= LINE_WIDTH) {
    left = left.slice(0, LINE_WIDTH - right.length - 1);
    return left + " " + right;
  }
  return left + " ".repeat(space) + right;
}

function divider(ch = "-"): number[] {
  return textLine(ch.repeat(LINE_WIDTH));
}

export type ReceiptOrder = {
  nomor_invoice?: string;
  kode_tracking?: string;
  created_at?: string;
  pelanggan_nama?: string;
  kasir_nama?: string;
  items?: any[];
  subtotal?: number;
  diskon?: number;
  diskon_nominal?: number;
  total?: number;
  status_bayar?: string;
  metode_bayar?: string;
  catatan?: string;
};

const NAMA_TOKO = "HANUM LAUNDRY";

export function buildEscPos(order: ReceiptOrder): number[] {
  let b: number[] = [];
  b.push(ESC, 0x40); // init
  b.push(ESC, 0x61, 0x01); // center
  b.push(ESC, 0x21, 0x30); // double height+width
  b = b.concat(textLine(NAMA_TOKO));
  b.push(ESC, 0x21, 0x00); // normal
  b = b.concat(textLine("Nota Laundry"));
  b.push(ESC, 0x61, 0x00); // left
  b = b.concat(divider());
  b = b.concat(textLine("No   : " + (order.nomor_invoice || "-")));
  b = b.concat(textLine("Lacak: " + (order.kode_tracking || "-")));
  b = b.concat(textLine("Nama : " + (order.pelanggan_nama || "-")));
  b = b.concat(textLine("Kasir: " + (order.kasir_nama || "-")));
  b = b.concat(divider());
  (order.items || []).forEach((it) => {
    b = b.concat(textLine(it.nama_layanan || "-"));
    const qty = `${it.qty}${it.satuan || ""} x ${rpRaw(it.harga)}`;
    b = b.concat(textLine(twoCol("  " + qty, rpRaw(it.subtotal))));
  });
  b = b.concat(divider());
  b = b.concat(textLine(twoCol("Subtotal", rpRaw(order.subtotal))));
  if ((order.diskon_nominal || 0) > 0) {
    b = b.concat(textLine(twoCol(`Diskon (${order.diskon}%)`, "-" + rpRaw(order.diskon_nominal))));
  }
  b.push(ESC, 0x21, 0x08); // bold
  b = b.concat(textLine(twoCol("TOTAL", rpRaw(order.total))));
  b.push(ESC, 0x21, 0x00);
  b = b.concat(textLine("Bayar: " + (order.status_bayar === "lunas" ? "LUNAS" : "BELUM BAYAR") + " (" + (order.metode_bayar || "-") + ")"));
  if (order.catatan) {
    b = b.concat(divider());
    b = b.concat(textLine("Catatan: " + order.catatan));
  }
  b = b.concat(divider());
  b.push(ESC, 0x61, 0x01); // center
  b = b.concat(textLine("Terima kasih"));
  b = b.concat(textLine("Bersih - Wangi - Rapi"));
  b.push(LF, LF, LF);
  b.push(GS, 0x56, 0x42, 0x00); // cut
  return b;
}
