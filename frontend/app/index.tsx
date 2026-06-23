import { Redirect } from "expo-router";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { useAuth } from "@/src/auth";
import { AppText } from "@/src/components/ui";
import { C, F } from "@/src/theme";
import { Ionicons } from "@expo/vector-icons";

export default function Index() {
  const { user, loading, isStaff } = useAuth();

  if (loading) {
    return (
      <View style={styles.splash} testID="splash-screen">
        <View style={styles.logo}>
          <Ionicons name="water" size={44} color="#fff" />
        </View>
        <AppText weight="extrabold" style={{ color: "#fff", fontSize: 24, marginTop: 16 }}>
          Hanum Laundry
        </AppText>
        <ActivityIndicator color="#fff" style={{ marginTop: 24 }} />
      </View>
    );
  }

  if (!user) return <Redirect href="/login" />;
  if (isStaff) return <Redirect href="/(staff)/dashboard" />;
  return <Redirect href="/portal" />;
}

const styles = StyleSheet.create({
  splash: { flex: 1, backgroundColor: C.teal, alignItems: "center", justifyContent: "center" },
  logo: {
    width: 90,
    height: 90,
    borderRadius: 24,
    backgroundColor: "rgba(255,255,255,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
});
