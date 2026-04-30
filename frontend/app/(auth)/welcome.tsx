import { View, Text, StyleSheet, TouchableOpacity, Image, ScrollView } from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowRight, Shield, MapPin, Star } from "lucide-react-native";
import { colors, brutal } from "../../src/theme";

export default function Welcome() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container} showsVerticalScrollIndicator={false}>
        <View style={styles.heroBox}>
          <Text style={styles.tag}>HUSTLE • NEARBY</Text>
          <Text style={styles.logo}>QUICK<Text style={{ color: colors.primary }}>GIG</Text></Text>
          <Text style={styles.subtitle}>
            Post small jobs.{"\n"}Earn fast cash.{"\n"}All in your neighborhood.
          </Text>
        </View>

        <View style={styles.heroImageWrap}>
          <Image
            source={{ uri: "https://images.unsplash.com/photo-1753024678749-6fa3f0ce8a16?crop=entropy&cs=srgb&fm=jpg&ixid=M3w3NTY2NjZ8MHwxfHNlYXJjaHwxfHxhYnN0cmFjdCUyMG5lbyUyMGJydXRhbGlzbSUyMHBhdHRlcm58ZW58MHx8fHwxNzc3NTU1MTM1fDA&ixlib=rb-4.1.0&q=85" }}
            style={styles.heroImage}
          />
        </View>

        <View style={styles.features}>
          <FeatureRow icon={<MapPin size={22} color="#000" strokeWidth={2.5} />} title="Nearby Jobs" desc="Find gigs within your custom radius" color={colors.secondary} />
          <FeatureRow icon={<Shield size={22} color="#000" strokeWidth={2.5} />} title="ID Verified" desc="Both parties verify for safety" color={colors.yellow} />
          <FeatureRow icon={<Star size={22} color="#000" strokeWidth={2.5} />} title="Rate & Review" desc="Build your reputation gig by gig" color={colors.purple} />
        </View>

        <TouchableOpacity
          testID="get-started-btn"
          style={[brutal.buttonPrimary, styles.cta]}
          onPress={() => router.push("/(auth)/register")}
        >
          <Text style={brutal.buttonText}>Get Started</Text>
          <ArrowRight size={20} color="#000" strokeWidth={3} />
        </TouchableOpacity>

        <TouchableOpacity
          testID="signin-link"
          style={[brutal.buttonOutline, styles.cta]}
          onPress={() => router.push("/(auth)/login")}
        >
          <Text style={brutal.buttonText}>I already have an account</Text>
        </TouchableOpacity>

        <TouchableOpacity testID="admin-link" onPress={() => router.push("/admin")}>
          <Text style={styles.adminLink}>Admin Login</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

function FeatureRow({ icon, title, desc, color }: any) {
  return (
    <View style={[styles.featureRow, { backgroundColor: color }]}>
      <View style={styles.iconBox}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.featureTitle}>{title}</Text>
        <Text style={styles.featureDesc}>{desc}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  heroBox: { paddingTop: 12 },
  tag: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 2,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  logo: { fontSize: 56, fontWeight: "900", letterSpacing: -3, color: colors.text, lineHeight: 56 },
  subtitle: {
    fontSize: 18,
    fontWeight: "600",
    color: colors.text,
    marginTop: 12,
    lineHeight: 26,
  },
  heroImageWrap: {
    height: 160,
    borderWidth: 2,
    borderColor: "#000",
    overflow: "hidden",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  heroImage: { width: "100%", height: "100%" },
  features: { gap: 12, marginTop: 8 },
  featureRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderWidth: 2,
    borderColor: "#000",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  iconBox: {
    width: 44,
    height: 44,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  featureTitle: { fontSize: 16, fontWeight: "900", color: "#000" },
  featureDesc: { fontSize: 13, fontWeight: "500", color: "#000" },
  cta: { marginTop: 8 },
  adminLink: {
    textAlign: "center",
    fontWeight: "800",
    color: colors.textSecondary,
    marginTop: 20,
    textDecorationLine: "underline",
    letterSpacing: 0.5,
  },
});
