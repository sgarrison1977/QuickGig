import { useState } from "react";
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
  Platform,
  Alert,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as WebBrowser from "expo-web-browser";
import Constants from "expo-constants";
import { ShieldCheck, ArrowLeft, Camera, Lock, Check } from "lucide-react-native";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors } from "../src/theme";

function getReturnOrigin(): string {
  const fromEnv = process.env.EXPO_PUBLIC_RETURN_ORIGIN;
  if (fromEnv) return fromEnv.replace(/\/+$/, "");
  const backend = process.env.EXPO_PUBLIC_BACKEND_URL;
  if (backend) return backend.replace(/\/+$/, "").replace(/\/api$/, "");
  const hostUri = (Constants as any)?.expoConfig?.hostUri;
  if (hostUri) return `https://${String(hostUri).split(":")[0]}`;
  return "https://app.invalid";
}

export default function VerifyId() {
  const router = useRouter();
  const { user, refresh } = useAuth();
  const [loading, setLoading] = useState(false);

  const startVerification = async () => {
    setLoading(true);
    try {
      const origin = getReturnOrigin();
      const res = await api<{ url: string; session_id: string; already_verified?: boolean }>(
        "/verify/id/start",
        { method: "POST", body: { return_url: origin } }
      );
      if ((res as any).already_verified) {
        Alert.alert("Already verified", "You're already ID-verified ✅");
        await refresh().catch(() => {});
        router.replace("/(tabs)/profile");
        return;
      }
      if (Platform.OS === "web") {
        window.location.href = res.url;
        return;
      }
      // Open Stripe Identity hosted flow in an in-app browser
      await WebBrowser.openBrowserAsync(res.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
        showTitle: true,
        dismissButtonStyle: "close",
      });
      // After browser closes, poll for status
      let attempts = 0;
      const maxAttempts = 12;
      while (attempts < maxAttempts) {
        try {
          const s = await api<{ status: string; verified: boolean }>(
            `/verify/id/status/${res.session_id}`
          );
          if (s.verified) {
            await refresh().catch(() => {});
            Alert.alert("Verified! ✅", "Your ID is now verified.");
            router.replace("/(tabs)/profile");
            return;
          }
          if (s.status === "requires_input" && attempts > 1) break;
        } catch {}
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      Alert.alert(
        "Submitted",
        "Your verification is being reviewed. It usually takes a minute or two — your badge will appear automatically once approved."
      );
      router.replace("/(tabs)/profile");
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Failed to start verification");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="back-btn">
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Verify your ID</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.heroIcon}>
          <ShieldCheck size={56} color="#fff" strokeWidth={2.4} />
        </View>

        <Text style={styles.title}>Get the ID-verified badge</Text>
        <Text style={styles.subtitle}>
          Stand out as trustworthy. Verified profiles get more job acceptances and can apply to
          gigs that require verification.
        </Text>

        <View style={styles.bullets}>
          <Bullet icon={<Camera size={18} color={colors.primary} strokeWidth={2.6} />}
            title="Quick & secure"
            sub="Scan a government ID + take a selfie. Powered by Stripe Identity." />
          <Bullet icon={<Lock size={18} color={colors.primary} strokeWidth={2.6} />}
            title="Your data is encrypted"
            sub="QuickGig never sees your ID — Stripe handles it directly." />
          <Bullet icon={<Check size={18} color={colors.primary} strokeWidth={2.6} />}
            title="Usually under 2 minutes"
            sub="Approval is automatic. Badge appears as soon as it's verified." />
        </View>

        <View style={styles.priceCard}>
          <Text style={styles.priceLabel}>Free</Text>
          <Text style={styles.priceSub}>QuickGig covers the verification fee.</Text>
        </View>

        {user?.is_verified ? (
          <View style={styles.alreadyCard}>
            <ShieldCheck size={20} color={colors.verified} strokeWidth={2.6} />
            <Text style={styles.alreadyText}>You're already verified ✓</Text>
          </View>
        ) : (
          <TouchableOpacity
            testID="start-verify"
            style={[styles.cta, loading && { opacity: 0.6 }]}
            onPress={startVerification}
            disabled={loading}
            activeOpacity={0.88}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.ctaText}>Start verification</Text>
            )}
          </TouchableOpacity>
        )}

        <Text style={styles.footnote}>
          By tapping Start verification, you'll be redirected to Stripe Identity, the same
          provider used by Doordash, Lyft, and other trusted apps.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ icon, title, sub }: any) {
  return (
    <View style={styles.bullet}>
      <View style={styles.bulletIcon}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.bulletTitle}>{title}</Text>
        <Text style={styles.bulletSub}>{sub}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitle: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  content: { padding: 24, paddingBottom: 40, gap: 14 },
  heroIcon: {
    alignSelf: "center",
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.verified,
    alignItems: "center",
    justifyContent: "center",
    marginVertical: 8,
  },
  title: {
    fontSize: 26,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.7,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 14.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    marginBottom: 8,
  },
  bullets: { gap: 10, marginTop: 4 },
  bullet: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 16,
  },
  bulletIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  bulletTitle: { fontSize: 14.5, fontWeight: "800", color: colors.text },
  bulletSub: { fontSize: 12.5, color: colors.textSecondary, fontWeight: "500", marginTop: 2, lineHeight: 17 },
  priceCard: {
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    borderRadius: 14,
    alignItems: "center",
    marginTop: 4,
  },
  priceLabel: { fontSize: 24, fontWeight: "900", color: colors.text, letterSpacing: -0.5 },
  priceSub: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: 2 },
  cta: {
    paddingVertical: 16,
    borderRadius: 16,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    marginTop: 6,
  },
  ctaText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: -0.3 },
  alreadyCard: {
    flexDirection: "row",
    gap: 8,
    alignItems: "center",
    justifyContent: "center",
    padding: 14,
    backgroundColor: "#E8F5E9",
    borderRadius: 14,
  },
  alreadyText: { fontWeight: "800", color: colors.verified, fontSize: 14 },
  footnote: {
    fontSize: 11.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    marginTop: 8,
    lineHeight: 16,
  },
});
