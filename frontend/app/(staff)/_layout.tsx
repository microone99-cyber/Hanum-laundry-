import { Tabs } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Redirect } from "expo-router";
import { useAuth } from "@/src/auth";
import { C, F } from "@/src/theme";

export default function StaffLayout() {
  const { user, loading, isStaff } = useAuth();
  if (loading) return null;
  if (!user) return <Redirect href="/login" />;
  if (!isStaff) return <Redirect href="/portal" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: C.brand,
        tabBarInactiveTintColor: C.muted,
        tabBarStyle: {
          backgroundColor: C.panel,
          borderTopColor: C.border,
          height: 64,
          paddingBottom: 8,
          paddingTop: 6,
        },
        tabBarLabelStyle: { fontFamily: F.semibold, fontSize: 11 },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Beranda", tabBarIcon: ({ color, size }) => <Ionicons name="grid" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="pos"
        options={{ title: "Order Baru", tabBarIcon: ({ color, size }) => <Ionicons name="add-circle" color={color} size={size + 4} /> }}
      />
      <Tabs.Screen
        name="orders"
        options={{ title: "Pesanan", tabBarIcon: ({ color, size }) => <Ionicons name="receipt" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="customers"
        options={{ title: "Pelanggan", tabBarIcon: ({ color, size }) => <Ionicons name="people" color={color} size={size} /> }}
      />
      <Tabs.Screen
        name="more"
        options={{ title: "Lainnya", tabBarIcon: ({ color, size }) => <Ionicons name="ellipsis-horizontal-circle" color={color} size={size} /> }}
      />
    </Tabs>
  );
}
