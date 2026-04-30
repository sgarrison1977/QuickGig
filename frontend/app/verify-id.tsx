import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as ImagePicker from "expo-image-picker";
import { ShieldCheck, Camera, Check } from "lucide-react-native";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, brutal } from "../src/theme";

export default function VerifyId() {
  const router = useRouter();
  const { setUser, refresh } = useAuth();
  const [idImage, setIdImage] = useState<string | null>(null);
  const [selfie, setSelfie] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const pick = async (which: "id" | "selfie") => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErr("Photo library permission required");
      return;
    }
    const res = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: true,
      base64: true,
      quality: 0.5,
    });
    if (!res.canceled && res.assets?.[0]?.base64) {
      const b64 = `data:image/jpeg;base64,${res.assets[0].base64}`;
      if (which === "id") setIdImage(b64);
      else setSelfie(b64);
    }
  };

  const submit = async () => {
    if (!idImage) {
      setErr("Please upload your ID document");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const u = await api("/auth/verify-id", {
        method: "POST",
        body: { id_document: idImage, selfie },
      });
      setUser(u);
      await refresh();
      router.replace("/(tabs)/browse");
    } catch (e: any) {
      setErr(e.message || "Verification failed");
    } finally {
      setLoading(false);
    }
  };

  const skip = () => router.replace("/(tabs)/browse");

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.iconHeader}>
          <ShieldCheck size={36} color="#000" strokeWidth={2.5} />
        </View>
        <Text style={styles.title}>Verify your{"\n"}identity.</Text>
        <Text style={styles.subtitle}>
          Both job posters and workers must verify ID for everyone&apos;s safety. Upload a photo of your government-issued ID.
        </Text>

        <View style={styles.uploadRow}>
          <UploadCard
            label="ID Document"
            image={idImage}
            onPress={() => pick("id")}
            color={colors.yellow}
            testID="upload-id"
          />
          <UploadCard
            label="Selfie (optional)"
            image={selfie}
            onPress={() => pick("selfie")}
            color={colors.secondary}
            testID="upload-selfie"
          />
        </View>

        {err ? <Text style={styles.err} testID="verify-error">{err}</Text> : null}

        <TouchableOpacity
          testID="verify-submit"
          style={[brutal.buttonPrimary, !idImage && { opacity: 0.5 }]}
          onPress={submit}
          disabled={!idImage || loading}
        >
          {loading ? (
            <ActivityIndicator color="#000" />
          ) : (
            <>
              <Check size={18} color="#000" strokeWidth={3} />
              <Text style={brutal.buttonText}>Submit & Verify</Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity testID="skip-verify" style={brutal.buttonOutline} onPress={skip}>
          <Text style={brutal.buttonText}>Skip for now (browse only)</Text>
        </TouchableOpacity>

        <Text style={styles.note}>
          Your ID is stored securely and only used for safety verification. You won&apos;t be able to post or accept jobs until verified.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function UploadCard({ label, image, onPress, color, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      style={[styles.uploadCard, { backgroundColor: color }]}
    >
      {image ? (
        <Image source={{ uri: image }} style={styles.uploadImage} />
      ) : (
        <View style={styles.uploadEmpty}>
          <Camera size={28} color="#000" strokeWidth={2.5} />
        </View>
      )}
      <Text style={styles.uploadLabel}>{label}</Text>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16 },
  iconHeader: {
    width: 64,
    height: 64,
    borderWidth: 2,
    borderColor: "#000",
    backgroundColor: colors.alt,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  title: { fontSize: 36, fontWeight: "900", color: "#000", letterSpacing: -1.5, lineHeight: 38 },
  subtitle: { fontSize: 15, color: colors.textSecondary, fontWeight: "600", lineHeight: 22 },
  uploadRow: { flexDirection: "row", gap: 12, marginTop: 12 },
  uploadCard: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#000",
    padding: 12,
    alignItems: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  uploadEmpty: {
    width: "100%",
    height: 110,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  uploadImage: {
    width: "100%",
    height: 110,
    borderWidth: 2,
    borderColor: "#000",
  },
  uploadLabel: { fontWeight: "900", fontSize: 13, color: "#000", textTransform: "uppercase" },
  err: {
    color: "#fff",
    backgroundColor: colors.error,
    padding: 10,
    borderWidth: 2,
    borderColor: "#000",
    fontWeight: "700",
  },
  note: { fontSize: 12, color: colors.textSecondary, fontWeight: "500", marginTop: 8, lineHeight: 18 },
});
