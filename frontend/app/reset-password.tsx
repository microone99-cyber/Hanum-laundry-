import { useState } from "react";
import { View, StyleSheet, ScrollView, Pressable, KeyboardAvoidingView, Platform } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { api } from "@/src/api";
import { AppText, Button, Field } from "@/src/components/ui";
import { C, SP, R } from "@/src/theme";

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = typeof params.token === "string" ? params.token : "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  const submit = async () => {
    setErr("");
    if (!token) {
      setErr("Link reset tidak valid. Buka lagi link dari email kamu.");
      return;
    }
    if (password.length < 6) {
      setErr("Kata sandi minimal 6 karakter.");
      return;
    }
    if (password !== confirm) {
      setErr("Konfirmasi kata sandi tidak sama.");
      return;
    }
    setBusy(true);
    try {
      await api.post("/auth/reset-password", { token, password });
      setDone(true);
    } catch (e: any) {
      setErr(e.message || "Link reset tidak valid atau sudah kedaluwarsa.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.header}>
          <View style={styles.logo}>
            <Ionicons name="lock-open" size={34} color="#fff" />
          </View>
          <AppText weight="extrabold" style={{ fontSize: 24, color: C.ink }}>Buat Kata Sandi Baru</AppText>
        </View>

        <View style={styles.formCard}>
          {done ? (
            <>
              <AppText weight="semibold" style={{ color: C.success, marginBottom: SP.md }} testID="reset-success">
                Kata sandi berhasil diubah. Silakan masuk pakai kata sandi baru kamu.
              </AppText>
              <Button title="Masuk Sekarang" onPress={() => router.replace("/login")} testID="reset-go-login" />
            </>
          ) : (
            <>
              <Field label="Kata sandi baru" placeholder="Min. 6 karakter" secureTextEntry value={password} onChangeText={setPassword} testID="reset-password-input" />
              <View style={{ height: SP.md }} />
              <Field label="Ulangi kata sandi baru" placeholder="Ulangi kata sandi" secureTextEntry value={confirm} onChangeText={setConfirm} testID="reset-confirm-input" />
              {err ? <AppText style={{ color: C.danger, marginTop: SP.md }} testID="reset-error">{err}</AppText> : null}
              <View style={{ height: SP.lg }} />
              <Button title="Simpan Kata Sandi Baru" onPress={submit} loading={busy} testID="reset-submit-button" />
              <Pressable onPress={() => router.replace("/login")} style={{ marginTop: SP.md, alignItems: "center" }} testID="reset-back">
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
