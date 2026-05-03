import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { XCircle } from "lucide-react-native";
import { colors } from "../../src/theme";

export default function BillingCancel() {
  const router = useRouter();
  const { package: pkg } = useLocalSearchParams<{ package?: string }>();

  const tryAgain = () => {
    if (pkg === "boost_24h" || pkg === "boost_48h") {
      router.replace("/(tabs)/post");
    } else {
      router.replace("/upgrade");
    }
  };

  return (
    <SafeAreaView style={styles.safe}>
      <LinearGradient colors={[colors.bg, colors.surface]} style={styles.bg}>
        <View style={styles.center}>
          <View style={styles.iconCircle}>
            <XCircle size={56} color="#fff" strokeWidth={2.4} />
          </View>
          <Text style={styles.title}>Payment cancelled</Text>
          <Text style={styles.subtitle}>
            No charges were made. You can try again whenever you're ready.
          </Text>
          <TouchableOpacity style={styles.cta} onPress={tryAgain} activeOpacity={0.88}>
            <Text style={styles.ctaText}>Try Again</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.linkBtn}
            onPress={() => router.replace("/(tabs)/browse")}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>Back to Browse</Text>
          </TouchableOpacity>
        </View>
      </LinearGradient>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  bg: { flex: 1 },
  center: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 14 },
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
  iconCircle: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: "#9CA3AF",
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
