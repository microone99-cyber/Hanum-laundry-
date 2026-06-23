import React from "react";
import { View, StyleSheet, Pressable } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "@/src/components/ui";
import { C, SP } from "@/src/theme";

export function Header({
  title,
  subtitle,
  right,
  back,
  onBack,
}: {
  title: string;
  subtitle?: string;
  right?: React.ReactNode;
  back?: boolean;
  onBack?: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.wrap, { paddingTop: insets.top + SP.sm }]}>
      <View style={styles.row}>
        <View style={{ flexDirection: "row", alignItems: "center", flex: 1, gap: SP.sm }}>
          {back && (
            <Pressable onPress={onBack} hitSlop={10} testID="header-back">
              <Ionicons name="chevron-back" size={26} color={C.ink} />
            </Pressable>
          )}
          <View style={{ flex: 1 }}>
            <AppText weight="extrabold" style={{ fontSize: 22 }}>{title}</AppText>
            {subtitle ? <AppText style={{ color: C.muted, fontSize: 13, marginTop: 1 }}>{subtitle}</AppText> : null}
          </View>
        </View>
        {right}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: C.panel,
    paddingHorizontal: SP.lg,
    paddingBottom: SP.md,
    borderBottomWidth: 1,
    borderBottomColor: C.border,
  },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", gap: SP.md },
});
