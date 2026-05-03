import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function VerifyIdReturn() {
  const { vs } = useLocalSearchParams<{ vs?: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<"loading" | "verified" | "pending" | "error">("loading");

  useEffect(() => {
    if (!vs) {
      setState("error");
      return;
    }
    let cancelled = false;
    (async () => {
      let attempts = 0;
      while (!cancelled && attempts < 15) {
        try {
          const s = await api<{ status: string; verified: boolean }>(
            `/verify/id/status/${vs}`
          );
          if (cancelled) return;
          if (s.verified) {
            await refresh().catch(() => {});
            setState("verified");
            return;
          }
          if (s.status === "requires_input" && attempts > 1) break;
        } catch {}
        attempts++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setState("pending");
    })();
    return () => {
      cancelled = true;
    };
  }, [vs, refresh]);

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={{ flex: 1 }}>
        <View style={styles.center}>
          {state === "loading" ? (
            <>
              <ActivityIndicator size="large" color={colors.primary} />
              <Text style={styles.title}>Confirming verification…</Text>
              <Text style={styles.sub}>Hang tight, this only takes a few seconds.</Text>
            </>
          ) : state === "verified" ? (
            <>
              <View style={[styles.icon, { backgroundColor: colors.verified }]}>
                <CheckCircle size={56} color="#fff" strokeWidth={2.4} />
              </View>
              <Text style={styles.title}>Verified! ✅</Text>
              <Text style={styles.sub}>Your profile now has the verified badge.</Text>
              <TouchableOpacity style={styles.cta} onPress={() => router.replace("/(tabs)/profile")}>
                <Text style={styles.ctaText}>Go to Profile</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View style={[styles.icon, { backgroundColor: "#F59E0B" }]}>
                <AlertCircle size={56} color="#fff" strokeWidth={2.4} />
              </View>
              <Text style={styles.title}>
                {state === "pending" ? "Almost there" : "We need another try"}
              </Text>
              <Text style={styles.sub}>
                {state === "pending"
                  ? "Your verification is being processed. Your badge will appear automatically once approved — usually within a minute."
                  : "Stripe couldn't verify your ID. Please try again with better lighting or a clearer photo."}
              </Text>
              <TouchableOpacity style={styles.cta} onPress={() => router.replace("/(tabs)/profile")}>
                <Text style={styles.ctaText}>Back to Profile</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
  icon: {
    width: 100,
    height: 100,
    borderRadius: 50,
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: -0.5,
    textAlign: "center",
    marginTop: 18,
  },
  sub: {
    fontSize: 14.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 20,
    maxWidth: 320,
  },
  cta: {
    marginTop: 18,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: -0.2 },
});
