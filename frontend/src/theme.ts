// HANUM Laundry design tokens — derived from /app/design_guidelines.json
export const C = {
  surface: "#F1F5F9",
  panel: "#FFFFFF",
  panel2: "#F8FAFC",
  ink: "#0F172A",
  muted: "#64748B",
  border: "#E2E8F0",
  borderStrong: "#CBD5E1",

  brand: "#6366F1",
  brandDark: "#4F46E5",
  brandTint: "#E0E7FF",
  accent: "#0EA5E9",

  success: "#16A34A",
  warning: "#F59E0B",
  danger: "#EF4444",

  // status pills
  proses_bg: "#E0F2FE",
  proses_fg: "#0369A1",
  siap_bg: "#DCFCE7",
  siap_fg: "#15803D",
  selesai_bg: "#E2E8F0",
  selesai_fg: "#334155",
  batal_bg: "#FEE2E2",
  batal_fg: "#B91C1C",

  // role pills
  role_owner: "#6D28D9",
  role_admin: "#0369A1",
  role_kasir: "#B45309",
  role_pelanggan: "#64748B",

  teal: "#245D56",
  white: "#FFFFFF",
};

export const SP = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32, xxxl: 48 };
export const R = { sm: 6, md: 12, lg: 16, pill: 999 };

export const F = {
  regular: "PlusJakartaSans-Regular",
  medium: "PlusJakartaSans-Medium",
  semibold: "PlusJakartaSans-SemiBold",
  bold: "PlusJakartaSans-Bold",
  extrabold: "PlusJakartaSans-ExtraBold",
  mono: "SpaceMono",
};

export const STATUS_LABEL: Record<string, string> = {
  proses: "Proses",
  siap: "Siap",
  selesai: "Selesai",
  batal: "Dibatalkan",
};

export function statusColors(s: string) {
  switch (s) {
    case "proses":
      return { bg: C.proses_bg, fg: C.proses_fg };
    case "siap":
      return { bg: C.siap_bg, fg: C.siap_fg };
    case "selesai":
      return { bg: C.selesai_bg, fg: C.selesai_fg };
    case "batal":
      return { bg: C.batal_bg, fg: C.batal_fg };
    default:
      return { bg: C.selesai_bg, fg: C.selesai_fg };
  }
}

export function roleColor(r: string) {
  switch (r) {
    case "owner":
      return C.role_owner;
    case "admin":
      return C.role_admin;
    case "kasir":
      return C.role_kasir;
    default:
      return C.role_pelanggan;
  }
}

export const ROLE_LABEL: Record<string, string> = {
  owner: "Pemilik",
  admin: "Admin",
  kasir: "Kasir",
  pelanggan: "Pelanggan",
};
