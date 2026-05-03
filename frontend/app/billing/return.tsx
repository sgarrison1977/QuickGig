import { useEffect, useState } from "react";
import { View, Text, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { CheckCircle, AlertCircle } from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

type Status = {
  session_id: string;
  status: string;
  payment_status: string;
  credited?: boolean;
};

export default function BillingReturn() {
  const { session_id } = useLocalSearchParams<{ session_id: string }>();
  const router = useRouter();
  const { refresh } = useAuth();
  const [state, setState] = useState<"loading" | "paid" | "pending" | "error">("loading");
  const [tries, setTries] = useState(0);

  useEffect(() => {
    if (!session_id) {
      setState("error");
      return;
    }
    let cancelled = false;
    let attempt = 0;
    const poll = async () => {
      while (!cancelled && attempt < 15) {
        try {
          const s = await api<Status>(`/billing/checkout/status/${session_id}`);
          if (cancelled) return;
          setTries(attempt + 1);
          if (s.payment_status === "paid") {
            await refresh().catch(() => {});
            setState("paid");
            return;
          }
          if (s.status === "expired") {
            setState("error");
            return;
          }
        } catch {}
        attempt++;
        await new Promise((r) => setTimeout(r, 2000));
      }
      if (!cancelled) setState("pending");
    };
    poll();
    return () => {
      cancelled = true;
    };
  }, [session_id, refresh]);

  const goHome = () => router.replace("/(tabs)/browse");
  const goProfile = () => router.replace("/(tabs)/profile");

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.bg}>
        {state === "loading" ? (
          <View style={styles.center}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.title}>Confirming your payment…</Text>
            <Text style={styles.subtitle}>Hang tight, this only takes a few seconds.</Text>
            {tries > 3 ? (
              <Text style={styles.subtle}>Still working ({tries})…</Text>
            ) : null}
          </View>
        ) : state === "paid" ? (
          <View style={styles.center}>
            <View style={styles.iconCircleGreen}>
              <CheckCircle size={56} color="#fff" strokeWidth={2.4} />
            </View>
            <Text style={styles.title}>Payment received! 🎉</Text>
            <Text style={styles.subtitle}>
              Your upgrade is active. Tap below to see it on your profile.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={goProfile} activeOpacity={0.88}>
              <Text style={styles.ctaText}>Go to Profile</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.linkBtn} onPress={goHome} activeOpacity={0.7}>
              <Text style={styles.linkText}>Back to Browse</Text>
            </TouchableOpacity>
          </View>
        ) : state === "pending" ? (
          <View style={styles.center}>
            <View style={styles.iconCircleYellow}>
              <AlertCircle size={56} color="#fff" strokeWidth={2.4} />
            </View>
            <Text style={styles.title}>Payment is processing</Text>
            <Text style={styles.subtitle}>
              We're still confirming with Stripe. Your upgrade will activate
              automatically the moment it clears — usually within a minute.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={goProfile} activeOpacity={0.88}>
              <Text style={styles.ctaText}>Check Profile</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.center}>
            <View style={styles.iconCircleRed}>
              <AlertCircle size={56} color="#fff" strokeWidth={2.4} />
            </View>
            <Text style={styles.title}>Couldn't confirm payment</Text>
            <Text style={styles.subtitle}>
              If you completed checkout, the upgrade may still apply within a
              minute via webhook. If you were charged but not credited, contact
              support.
            </Text>
            <TouchableOpacity style={styles.cta} onPress={goHome} activeOpacity={0.88}>
              <Text style={styles.ctaText}>Back to Browse</Text>
            </TouchableOpacity>
          </View>
        )}
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bg: { flex: 1 },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 14,
  },
  title: {
    fontSize: 22,
    fontWeight: "900",
    color: colors.text,
    textAlign: "center",
    letterSpacing: -0.5,
    marginTop: 18,
  },
  subtitle: {
    fontSize: 14.5,
    color: colors.textSecondary,
    textAlign: "center",
    fontWeight: "500",
    lineHeight: 20,
    maxWidth: 320,
  },
  subtle: { fontSize: 12.5, color: colors.textSecondary, fontWeight: "600", marginTop: 6 },
  iconCircleGreen: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#10B981",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleYellow: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#F59E0B",
    alignItems: "center",
    justifyContent: "center",
  },
  iconCircleRed: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  cta: {
    marginTop: 18,
    paddingHorizontal: 32,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 15, letterSpacing: -0.2 },
  linkBtn: { marginTop: 4, padding: 8 },
  linkText: { color: colors.textSecondary, fontWeight: "700", fontSize: 13 },
});
