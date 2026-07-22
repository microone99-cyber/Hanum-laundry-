// Money is always integer rupiah (no decimals).
export function rupiah(v?: number | null): string {
  const n = Math.round(Number(v ?? 0));
  return "Rp " + n.toLocaleString("id-ID");
}

export function rpRaw(v?: number | null): string {
  const n = Math.round(Number(v ?? 0));
  return n.toLocaleString("id-ID");
}

const BULAN = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];

export function tglID(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  return `${d.getDate()} ${BULAN[d.getMonth()]} ${d.getFullYear()}`;
}

export function tglJamID(iso?: string | null): string {
  if (!iso) return "-";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "-";
  const jam = d.getHours().toString().padStart(2, "0");
  const menit = d.getMinutes().toString().padStart(2, "0");
  return `${tglID(iso)} ${jam}:${menit}`;
}

export function todayISO(): string {
  return new Date().toISOString();
}

export function startOfMonthISO(): string {
  const d = new Date();
  return new Date(d.getFullYear(), d.getMonth(), 1).toISOString();
}
