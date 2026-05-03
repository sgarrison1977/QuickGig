import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { ArrowLeft, FileText } from "lucide-react-native";
import { colors } from "../src/theme";
import { EULA_TEXT, EULA_VERSION, EULA_EFFECTIVE_DATE } from "../src/eulaText";

export default function EulaScreen() {
  const router = useRouter();
  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back} testID="eula-back">
          <ArrowLeft size={22} color={colors.text} strokeWidth={2.6} />
        </TouchableOpacity>
        <View style={styles.headerTitleRow}>
          <FileText size={18} color={colors.text} strokeWidth={2.6} />
          <Text style={styles.headerTitle}>EULA</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Text style={styles.meta}>
          Version {EULA_VERSION} · Effective {EULA_EFFECTIVE_DATE}
        </Text>
        <Text style={styles.text}>{EULA_TEXT}</Text>
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
