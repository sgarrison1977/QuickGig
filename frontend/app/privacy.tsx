import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, Lock } from "lucide-react-native";
import { colors } from "../src/theme";
import { PRIVACY_TEXT, PRIVACY_VERSION, PRIVACY_EFFECTIVE_DATE, PRIVACY_LAST_UPDATED } from "../src/privacyText";

export default function PrivacyScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="privacy-back">
          <ArrowLeft size={22} color={colors.text} strokeWidth={2.6} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <Lock size={18} color={colors.text} strokeWidth={2.6} />
          <Text style={styles.headerTitle}>Privacy Policy</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.meta}>
          Version {PRIVACY_VERSION} · Effective {PRIVACY_EFFECTIVE_DATE} · Updated {PRIVACY_LAST_UPDATED}
        </Text>
        <Text style={styles.text}>{PRIVACY_TEXT}</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    backgroundColor: colors.surface,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
  },
  headerTitleRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  headerTitle: { fontSize: 17, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  body: { padding: 20, paddingBottom: 60, gap: 12 },
  meta: { fontSize: 11, fontWeight: "800", color: colors.textSecondary, letterSpacing: 0.6 },
  text: { fontSize: 13, lineHeight: 20, color: colors.text, fontWeight: "500" },
});
