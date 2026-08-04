import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { AppText, Button, Field } from "@/src/components/ui";
import { C, SP, R } from "@/src/theme";

export default function ForgotPassword() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!email.trim()) {
      setErr("Email wajib diisi.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/forgot-password", { email: email.trim() });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Terjadi kesalahan, coba lagi.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="key" size={34} color="#fff" />
          </View>
          <AppText weight="extrabold" style={{ fontSize: 24, color: C.ink }}>Lupa Kata Sandi</AppText>
          <AppText style={{ color: C.muted, marginTop: 2, textAlign: "center" }}>
            Masukkan email akun kamu, kami kirimkan link untuk membuat kata sandi baru.
          </AppText>
        </View>

        <View style={styles.formCard}>
          {done ? (
            <>
              <AppText weight="semibold" style={{ color: C.success, marginBottom: SP.md }} testID="forgot-success">
                Jika email tersebut terdaftar, link reset kata sandi sudah dikirim. Silakan cek kotak masuk (dan folder spam) email kamu.
              </AppText>
              <Button title="Kembali ke login" onPress={() => router.replace("/login")} testID="back-to-login" />
            </>
          ) : (
            <>
              <Field label="Email" placeholder="email@contoh.com" autoCapitalize="none" keyboardType="email-address" value={email} onChangeText={setEmail} testID="forgot-email-input" />
              {err ? <AppText style={{ color: C.danger, marginTop: SP.md }} testID="forgot-error">{err}</AppText> : null}
              <View style={{ height: SP.lg }} />
              <Button title="Kirim Link Reset" onPress={submit} loading={busy} testID="forgot-submit-button" />
              <Pressable onPress={() => router.back()} style={{ marginTop: SP.md, alignItems: "center" }} testID="forgot-back">
                <AppText weight="semibold" style={{ color: C.brand }}>← Kembali ke login</AppText>
              </Pressable>
            </>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 1, justifyContent: "center", padding: SP.xl, backgroundColor: C.surface },
  header: { alignItems: "center", marginBottom: SP.xl },
  logo: {
    width: 72, height: 72, borderRadius: 20, backgroundColor: C.teal,
    alignItems: "center", justifyContent: "center", marginBottom: SP.md,
  },
  formCard: {
    backgroundColor: C.panel, borderRadius: R.lg, padding: SP.xl,
    borderWidth: 1, borderColor: C.border,
  },
});
