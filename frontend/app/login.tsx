import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform, Image } from "react-native";
import { useRouter } from "expo-router";
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
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      {/* Dekorasi background - lingkaran samar teal & emas */}
      <View pointerEvents="none" style={styles.bgWrap}>
        <View style={[styles.blob, styles.blobTeal, { top: -80, left: -60 }]} />
        <View style={[styles.blob, styles.blobGold, { top: 40, right: -90 }]} />
        <View style={[styles.blob, styles.blobTeal, { bottom: -100, right: -60, width: 220, height: 220, borderRadius: 110 }]} />
        <View style={[styles.blob, styles.blobGold, { bottom: 60, left: -70, width: 140, height: 140, borderRadius: 70 }]} />
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.header}>
            <Image
              source={require("@/assets/images/logo-login.png")}
              style={styles.logo}
              resizeMode="cover"
            />
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
            {!isRegister && (
              <Pressable onPress={() => router.push("/forgot-password")} style={{ marginTop: SP.sm, alignItems: "center" }} testID="link-forgot-password">
                <AppText style={{ color: C.muted }}>Lupa kata sandi?</AppText>
              </Pressable>
            )}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  bgWrap: { ...StyleSheet.absoluteFillObject, overflow: "hidden" },
  blob: { position: "absolute", width: 260, height: 260, borderRadius: 130 },
  blobTeal: { backgroundColor: C.teal, opacity: 0.12 },
  blobGold: { backgroundColor: "#D4A857", opacity: 0.12 },
  scroll: { flexGrow: 1, justifyContent: "center", padding: SP.xl },
  header: { alignItems: "center", marginBottom: SP.xl },
  logo: {
    width: 80, height: 80, borderRadius: 20, marginBottom: SP.md,
  },
  formCard: {
    backgroundColor: C.panel, borderRadius: R.lg, padding: SP.xl,
    borderWidth: 1, borderColor: C.border,
  },
});
