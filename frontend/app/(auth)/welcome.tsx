import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowRight, Shield, MapPin, Star, Sparkles } from "lucide-react-native";
import { colors, brutal } from "../../src/theme";

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#FF5A5F", "#FF8A5C", "#FFC93C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <View style={styles.heroBadge}>
            <Sparkles size={12} color="#fff" strokeWidth={2.5} />
            <Text style={styles.heroBadgeText}>HUSTLE NEARBY</Text>
          </View>
          <Text style={styles.logo}>QuickGig</Text>
          <Text style={styles.heroSubtitle}>
            Post small jobs. Earn fast cash. All in your neighborhood.
          </Text>
          <View style={styles.heroStats}>
            <Stat n="8" l="Categories" />
            <View style={styles.heroDivider} />
            <Stat n="100mi" l="Max radius" />
            <View style={styles.heroDivider} />
            <Stat n="5★" l="Rated" />
          </View>
        </LinearGradient>

        <View style={styles.features}>
          <FeatureRow
            icon={<MapPin size={20} color={colors.primary} strokeWidth={2.4} />}
            title="Nearby Jobs"
            desc="Find gigs within your custom radius"
            tint={colors.primarySoft}
          />
          <FeatureRow
            icon={<Shield size={20} color={colors.secondary} strokeWidth={2.4} />}
            title="ID Verified"
            desc="Both parties verify for safety"
            tint={colors.secondarySoft}
          />
          <FeatureRow
            icon={<Star size={20} color={colors.accent} strokeWidth={2.4} />}
            title="Rate & Review"
            desc="Build your reputation gig by gig"
            tint={colors.accentSoft}
          />
        </View>

        <View style={styles.ctas}>
          <TouchableOpacity
            testID="get-started-btn"
            style={brutal.buttonPrimary}
            onPress={() => router.push("/(auth)/register")}
            activeOpacity={0.9}
          >
            <Text style={brutal.buttonText}>Get Started Free</Text>
            <ArrowRight size={18} color="#fff" strokeWidth={2.6} />
          </TouchableOpacity>

          <TouchableOpacity
            testID="signin-link"
            style={brutal.buttonOutline}
            onPress={() => router.push("/(auth)/login")}
            activeOpacity={0.85}
          >
            <Text style={brutal.buttonTextDark}>I already have an account</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity testID="admin-link" onPress={() => router.push("/admin")}>
          <Text style={styles.adminLink}>Admin Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function Stat({ n, l }: { n: string; l: string }) {
  return (
    <View style={{ alignItems: "center" }}>
      <Text style={styles.statNum}>{n}</Text>
      <Text style={styles.statLab}>{l}</Text>
    </View>
  );
}

function FeatureRow({ icon, title, desc, tint }: any) {
  return (
    <View style={[brutal.card, styles.featureRow]}>
      <View style={[styles.iconBox, { backgroundColor: tint }]}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 14, paddingBottom: 32 },
  hero: {
    borderRadius: 28,
    padding: 24,
    paddingTop: 28,
    paddingBottom: 28,
    gap: 14,
    overflow: "hidden",
  },
  heroBadge: {
    backgroundColor: "rgba(255,255,255,0.22)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    alignSelf: "flex-start",
  },
  heroBadgeText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
  logo: {
    fontSize: 52,
    fontWeight: "800",
    color: "#fff",
    letterSpacing: -1.6,
    lineHeight: 56,
  },
  heroSubtitle: {
    fontSize: 17,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "500",
    lineHeight: 24,
  },
  heroStats: {
    marginTop: 8,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.18)",
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 8,
    justifyContent: "space-around",
  },
  heroDivider: {
    width: 1,
    height: 28,
    backgroundColor: "rgba(255,255,255,0.32)",
  },
  statNum: { color: "#fff", fontWeight: "800", fontSize: 18, letterSpacing: -0.4 },
  statLab: { color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 11, marginTop: 2 },
  features: { gap: 12, marginTop: 4 },
  featureRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  iconBox: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontSize: 16, fontWeight: "700", color: colors.text },
  featureDesc: { fontSize: 13, fontWeight: "500", color: colors.textSecondary, marginTop: 2 },
  ctas: { gap: 10, marginTop: 8 },
  adminLink: {
    textAlign: "center",
    fontWeight: "600",
    color: colors.textSecondary,
    marginTop: 16,
    fontSize: 13,
  },
});
