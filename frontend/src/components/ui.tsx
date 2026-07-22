import React from "react";
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ActivityIndicator,
  TextInputProps,
  ViewStyle,
  StyleProp,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { C, SP, R, F, statusColors, STATUS_LABEL, roleColor, ROLE_LABEL } from "@/src/theme";

export function AppText(props: React.ComponentProps<typeof Text> & { weight?: keyof typeof F }) {
  const { weight = "regular", style, ...rest } = props;
  return <Text {...rest} style={[{ fontFamily: F[weight], color: C.ink }, style]} />;
}

export function Card({ children, style, testID }: { children: React.ReactNode; style?: StyleProp<ViewStyle>; testID?: string }) {
  return (
    <View testID={testID} style={[styles.card, style]}>
      {children}
    </View>
  );
}

export function Pill({ text, fg, bg, testID }: { text: string; fg: string; bg: string; testID?: string }) {
  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: bg }]}>
      <Text style={{ color: fg, fontSize: 12, fontFamily: F.bold }}>{text}</Text>
    </View>
  );
}

export function StatusPill({ status }: { status: string }) {
  const c = statusColors(status);
  return <Pill text={STATUS_LABEL[status] || status} fg={c.fg} bg={c.bg} testID={`status-pill-${status}`} />;
}

export function RolePill({ role }: { role: string }) {
  return <Pill text={ROLE_LABEL[role] || role} fg="#fff" bg={roleColor(role)} testID={`role-pill-${role}`} />;
}

export function Button({
  title,
  onPress,
  variant = "primary",
  loading,
  disabled,
  icon,
  testID,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: "primary" | "outline" | "danger" | "success" | "ghost";
  loading?: boolean;
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  testID?: string;
  style?: StyleProp<ViewStyle>;
}) {
  const bg =
    variant === "primary" ? C.brand : variant === "danger" ? C.danger : variant === "success" ? C.success : "transparent";
  const fg = variant === "outline" ? C.brand : variant === "ghost" ? C.ink : "#fff";
  const border = variant === "outline" ? C.brand : "transparent";
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.btn,
        { backgroundColor: bg, borderColor: border, borderWidth: variant === "outline" ? 1.5 : 0, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <View style={styles.btnInner}>
          {icon && <Ionicons name={icon} size={18} color={fg} />}
          <Text style={{ color: fg, fontFamily: F.bold, fontSize: 15 }}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}

export function Field({ label, style, ...props }: TextInputProps & { label?: string }) {
  return (
    <View style={{ gap: 6 }}>
      {label ? <AppText weight="semibold" style={{ fontSize: 13, color: C.muted }}>{label}</AppText> : null}
      <TextInput
        placeholderTextColor={C.muted}
        style={[styles.input, style]}
        {...props}
      />
    </View>
  );
}

export function EmptyState({ icon = "file-tray-outline", title, subtitle }: { icon?: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string }) {
  return (
    <View style={styles.empty} testID="empty-state">
      <View style={styles.emptyIcon}>
        <Ionicons name={icon} size={36} color={C.muted} />
      </View>
      <AppText weight="bold" style={{ fontSize: 16, marginTop: SP.md }}>{title}</AppText>
      {subtitle ? <AppText style={{ color: C.muted, textAlign: "center", marginTop: 4 }}>{subtitle}</AppText> : null}
    </View>
  );
}

export function Chip({ label, active, onPress, testID }: { label: string; active?: boolean; onPress?: () => void; testID?: string }) {
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      style={[styles.chip, { backgroundColor: active ? C.brand : C.panel, borderColor: active ? C.brand : C.border }]}
    >
      <Text style={{ color: active ? "#fff" : C.ink, fontFamily: F.semibold, fontSize: 13 }}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: C.panel,
    borderRadius: R.lg,
    padding: SP.lg,
    borderWidth: 1,
    borderColor: C.border,
    shadowColor: "#0F172A",
    shadowOpacity: 0.04,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: R.pill,
    alignSelf: "flex-start",
  },
  btn: {
    borderRadius: R.md,
    paddingVertical: 14,
    paddingHorizontal: 18,
    alignItems: "center",
    justifyContent: "center",
    minHeight: 48,
  },
  btnInner: { flexDirection: "row", alignItems: "center", gap: 8 },
  input: {
    backgroundColor: C.panel,
    borderRadius: R.md,
    borderWidth: 1,
    borderColor: C.border,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: F.regular,
    fontSize: 15,
    color: C.ink,
  },
  empty: { alignItems: "center", justifyContent: "center", paddingVertical: SP.xxxl, paddingHorizontal: SP.xl },
  emptyIcon: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: C.panel2,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: C.border,
  },
  chip: {
    height: 36,
    paddingHorizontal: 16,
    borderRadius: R.pill,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
    flexShrink: 0,
  },
});
