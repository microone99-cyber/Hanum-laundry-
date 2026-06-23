import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "@/src/auth";
import { AppText, Button, Field } from "@/src/components/ui";
import { C, SP, R, F } from "@/src/theme";

export default function Login() {
  const { login, register } = useAuth();
  const router = useRouter();
  const [isRegister, setIsRegister] = useState(false);
  const [nama, setNama] = useState("");
  const [telepon, setTelepon] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!email.trim() || !password) {
      setErr("Email dan kata sandi wajib diisi.");
      return;
    }
    if (isRegister && !nama.trim()) {
      setErr("Nama wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      if (isRegister) {
        await register(email.trim(), password, nama.trim(), telepon.trim());
      } else {
        await login(email.trim(), password);
      }
      router.replace("/");
    } catch (e: any) {
      setErr(e.message || "Gagal masuk");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="water" size={38} color="#fff" />
          </View>
          <AppText weight="extrabold" style={{ fontSize: 28, color: C.ink }}>Hanum Laundry</AppText>
          <AppText style={{ color: C.muted, marginTop: 2 }}>Sistem Kasir & Manajemen Laundry</AppText>
        </View>

        <View style={styles.formCard}>
          <AppText weight="bold" style={{ fontSize: 20, marginBottom: SP.md }}>
            {isRegister ? "Daftar Akun" : "Masuk"}
          </AppText>

          {isRegister && (
            <>
              <Field label="Nama" placeholder="Nama lengkap" value={nama} onChangeText={setNama} testID="register-nama-input" />
              <View style={{ height: SP.md }} />
              <Field label="No. WhatsApp" placeholder="08xxxx" keyboardType="phone-pad" value={telepon} onChangeText={setTelepon} testID="register-telepon-input" />
              <View style={{ height: SP.md }} />
            </>
          )}
          <Field label="Email" placeholder="email@contoh.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="login-email-input" />
          <View style={{ height: SP.md }} />
          <Field label="Kata sandi" placeholder="Min. 6 karakter" secureTextEntry value={password} onChangeText={setPassword} testID="login-password-input" />

          {err ? (
            <AppText style={{ color: C.danger, marginTop: SP.md }} testID="login-error">{err}</AppText>
          ) : null}

          <View style={{ height: SP.lg }} />
          <Button
            title={isRegister ? "Buat Akun" : "Masuk"}
            onPress={submit}
            loading={busy}
            testID="login-submit-button"
          />
          <Pressable onPress={() => { setIsRegister((v) => !v); setErr(""); }} style={{ marginTop: SP.md, alignItems: "center" }} testID="toggle-auth-mode">
            <AppText weight="semibold" style={{ color: C.brand }}>
              {isRegister ? "← Kembali ke login" : "Belum punya akun? Daftar"}
            </AppText>
          </Pressable>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: SP.xl, backgroundColor: C.surface },
  header: { alignItems: "center", marginBottom: SP.xl },
  logo: {
    width: 80, height: 80, borderRadius: 22, backgroundColor: C.teal,
    alignItems: "center", justifyContent: "center", marginBottom: SP.md,
  },
  formCard: {
    backgroundColor: C.panel, borderRadius: R.lg, padding: SP.xl,
    borderWidth: 1, borderColor: C.border,
  },
});
