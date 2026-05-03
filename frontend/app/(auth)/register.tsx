import { useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  NativeSyntheticEvent,
  NativeScrollEvent,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, UserPlus, Check, FileText, ShieldAlert } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";
import { EULA_TEXT, EULA_VERSION, EULA_EFFECTIVE_DATE } from "../../src/eulaText";

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  // EULA state
  const [eulaScrolled, setEulaScrolled] = useState(false);
  const [eulaAccepted, setEulaAccepted] = useState(false);
  const [showCheckboxNudge, setShowCheckboxNudge] = useState(false);
  const eulaScrollRef = useRef<ScrollView>(null);

  const onEulaScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (eulaScrolled) return; // latch true
    const { layoutMeasurement, contentOffset, contentSize } = e.nativeEvent;
    // Treat as "read" when within 24px of bottom
    const atBottom =
      layoutMeasurement.height + contentOffset.y >= contentSize.height - 24;
    if (atBottom) setEulaScrolled(true);
  };

  const onSubmit = async () => {
    if (!email || !password || !name) {
      setErr("Email, name and password are required");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    if (!eulaScrolled) {
      setErr("Please scroll through the entire EULA before continuing.");
      eulaScrollRef.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    if (!eulaAccepted) {
      setErr("You must check the box to confirm you've read and agree to the EULA.");
      setShowCheckboxNudge(true);
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await signUp(
        email.trim(),
        password,
        name.trim(),
        phone.trim() || undefined,
        { accepted: true, version: EULA_VERSION }
      );
      router.replace("/verify-id");
    } catch (e: any) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  const canSubmit = !!email && !!password && !!name && eulaScrolled && eulaAccepted && !loading;

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView
          contentContainerStyle={styles.container}
          keyboardShouldPersistTaps="handled"
        >
          <TouchableOpacity onPress={() => router.back()} testID="back-btn" style={styles.back}>
            <ArrowLeft size={24} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.title}>Join the{"\n"}hustle.</Text>
          <Text style={styles.subtitle}>Create your QuickGig account in seconds.</Text>

          <View style={styles.form}>
            <Text style={brutal.caption}>Full Name</Text>
            <TextInput
              testID="register-name"
              value={name}
              onChangeText={setName}
              placeholder="Jane Doe"
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={brutal.caption}>Email</Text>
            <TextInput
              testID="register-email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={brutal.caption}>Phone (optional)</Text>
            <TextInput
              testID="register-phone"
              value={phone}
              onChangeText={setPhone}
              placeholder="555-555-1234"
              keyboardType="phone-pad"
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={brutal.caption}>Password</Text>
            <TextInput
              testID="register-password"
              value={password}
              onChangeText={setPassword}
              placeholder="At least 6 characters"
              secureTextEntry
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            {/* ============ EULA SECTION ============ */}
            <View style={styles.eulaWrap} testID="eula-section">
              <View style={styles.eulaHeader}>
                <FileText size={18} color={colors.text} strokeWidth={2.6} />
                <Text style={styles.eulaTitle}>End User License Agreement</Text>
              </View>
              <Text style={styles.eulaMeta}>
                Version {EULA_VERSION} · Effective {EULA_EFFECTIVE_DATE}
              </Text>

              <View style={styles.warnCallout}>
                <ShieldAlert size={16} color="#92400E" strokeWidth={2.6} />
                <Text style={styles.warnText}>
                  Please scroll to the bottom. You must read the whole agreement before you can accept.
                </Text>
              </View>

              <View style={styles.eulaBox}>
                <ScrollView
                  ref={eulaScrollRef}
                  testID="eula-scroll"
                  style={styles.eulaScroll}
                  contentContainerStyle={{ padding: 14 }}
                  onScroll={onEulaScroll}
                  scrollEventThrottle={32}
                  nestedScrollEnabled
                >
                  <Text style={styles.eulaBody}>{EULA_TEXT}</Text>
                </ScrollView>
                {!eulaScrolled ? (
                  <View style={styles.scrollHint} pointerEvents="none">
                    <Text style={styles.scrollHintText}>↓ scroll to bottom ↓</Text>
                  </View>
                ) : null}
              </View>

              <TouchableOpacity
                testID="eula-checkbox"
                onPress={() => {
                  if (!eulaScrolled) {
                    setErr("Please scroll through the entire EULA first.");
                    return;
                  }
                  setEulaAccepted((v) => !v);
                  setErr(null);
                  setShowCheckboxNudge(false);
                }}
                activeOpacity={0.8}
                style={[
                  styles.checkRow,
                  showCheckboxNudge && !eulaAccepted ? styles.checkRowNudge : null,
                ]}
              >
                <View
                  style={[
                    styles.checkbox,
                    eulaAccepted && styles.checkboxOn,
                    !eulaScrolled && styles.checkboxDisabled,
                  ]}
                >
                  {eulaAccepted ? <Check size={16} color="#fff" strokeWidth={3.2} /> : null}
                </View>
                <Text
                  style={[
                    styles.checkLabel,
                    !eulaScrolled && { color: colors.textDisabled },
                  ]}
                >
                  I have read and agree to the QuickGig EULA (v{EULA_VERSION}). I understand QuickGig is{" "}
                  <Text style={styles.bold}>not responsible for payment disputes</Text> between users, and that QuickGig{" "}
                  <Text style={styles.bold}>can access chat history</Text> for safety and moderation.
                </Text>
              </TouchableOpacity>
            </View>
            {/* ============ /EULA SECTION ============ */}

            {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

            <TouchableOpacity
              testID="register-submit"
              onPress={onSubmit}
              disabled={!canSubmit}
              style={[brutal.buttonPrimary, !canSubmit && { opacity: 0.45 }]}
            >
              <UserPlus size={18} color="#000" strokeWidth={3} />
              <Text style={brutal.buttonText}>{loading ? "Creating..." : "Create Account"}</Text>
            </TouchableOpacity>

            <View style={styles.bottomRow}>
              <Text style={styles.muted}>Already have one?</Text>
              <Link href="/(auth)/login" testID="goto-login">
                <Text style={styles.link}> Sign in</Text>
              </Link>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16, paddingBottom: 60 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  title: {
    fontSize: 36,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1.2,
    marginTop: 16,
    lineHeight: 40,
  },
  subtitle: { fontSize: 15, color: colors.textSecondary, fontWeight: "500" },
  form: { gap: 10, marginTop: 16 },
  err: {
    color: colors.error,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    fontWeight: "600",
    fontSize: 13,
  },
  bottomRow: { flexDirection: "row", justifyContent: "center", marginTop: 20 },
  muted: { color: colors.textSecondary, fontWeight: "500" },
  link: { color: colors.primary, fontWeight: "700" },

  // EULA
  eulaWrap: { gap: 10, marginTop: 16 },
  eulaHeader: { flexDirection: "row", alignItems: "center", gap: 8 },
  eulaTitle: { fontSize: 16, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  eulaMeta: { fontSize: 11, fontWeight: "700", color: colors.textSecondary, letterSpacing: 0.4 },
  warnCallout: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    backgroundColor: "#FEF3C7",
    borderWidth: 1,
    borderColor: "#FDE68A",
    padding: 10,
    borderRadius: 12,
  },
  warnText: { flex: 1, color: "#92400E", fontWeight: "700", fontSize: 12.5, lineHeight: 17 },
  eulaBox: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 14,
    backgroundColor: "#FAFAFA",
    overflow: "hidden",
  },
  eulaScroll: { height: 240 },
  eulaBody: {
    fontSize: 12,
    lineHeight: 18,
    color: colors.text,
    fontWeight: "500",
  },
  scrollHint: {
    position: "absolute",
    bottom: 8,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  scrollHintText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#fff",
    backgroundColor: "rgba(15,23,42,0.85)",
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    letterSpacing: 0.4,
    overflow: "hidden",
  },
  checkRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    padding: 12,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  checkRowNudge: {
    borderColor: colors.error,
    backgroundColor: "#FEF2F2",
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 1,
  },
  checkboxOn: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  checkboxDisabled: {
    opacity: 0.5,
  },
  checkLabel: {
    flex: 1,
    fontSize: 12.5,
    lineHeight: 17,
    color: colors.text,
    fontWeight: "500",
  },
  bold: { fontWeight: "900", color: colors.text },
});
