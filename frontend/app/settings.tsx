import { useCallback, useState } from "react";
import { View, ScrollView, ActivityIndicator, Switch } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { api } from "@/src/api";
import { AppText, Card, Button, Field } from "@/src/components/ui";
import { Header } from "@/src/components/Header";
import { C, SP } from "@/src/theme";

export default function Settings() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [antarJemput, setAntarJemput] = useState(true);
  const [waKontak, setWaKontak] = useState("");
  const [msg, setMsg] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const s = await api.get("/settings");
      setAntarJemput(!!s.antar_jemput_enabled);
      setWaKontak(s.wa_kontak || "");
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const save = async () => {
    setSaving(true);
    setMsg("");
    try {
      await api.put("/settings", { antar_jemput_enabled: antarJemput, wa_kontak: waKontak.trim() });
      setMsg("Pengaturan berhasil disimpan.");
    } catch (e: any) {
      setMsg(e.message || "Gagal menyimpan.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <View style={{ flex: 1, backgroundColor: C.surface }}>
        <Header title="Pengaturan" back onBack={() => router.back()} />
        <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={C.brand} /></View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: C.surface }}>
      <Header title="Pengaturan" back onBack={() => router.back()} />
      <ScrollView contentContainerStyle={{ padding: SP.lg, gap: SP.lg }}>
        <Card style={{ gap: SP.md }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <View style={{ flex: 1, marginRight: SP.md }}>
              <AppText weight="semibold">Layanan Antar-Jemput</AppText>
              <AppText style={{ color: C.muted, fontSize: 13, marginTop: 2 }}>
                Kalau dimatikan, tombol "Minta Dijemput" / "Minta Diantar" akan hilang dari tampilan pelanggan (misalnya saat belum ada driver yang siap).
              </AppText>
            </View>
            <Switch value={antarJemput} onValueChange={setAntarJemput} trackColor={{ true: C.brand }} testID="toggle-antar-jemput-setting" />
          </View>
        </Card>

        <Card style={{ gap: SP.sm }}>
          <AppText weight="semibold">Nomor WhatsApp Kasir/Driver</AppText>
          <AppText style={{ color: C.muted, fontSize: 13 }}>
            Nomor ini dipakai untuk tombol "Chat WA" saat koordinasi jemput-antar. Format: 62xxxxxxxxxx (tanpa tanda + atau spasi).
          </AppText>
          <Field placeholder="628123456789" keyboardType="phone-pad" value={waKontak} onChangeText={setWaKontak} testID="wa-kontak-input" />
        </Card>

        {msg ? <AppText style={{ color: msg.includes("berhasil") ? C.success : C.danger }} testID="settings-message">{msg}</AppText> : null}

        <Button title="Simpan Pengaturan" onPress={save} loading={saving} testID="settings-save-button" />
      </ScrollView>
    </View>
  );
}
