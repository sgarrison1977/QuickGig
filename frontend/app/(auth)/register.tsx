import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, UserPlus } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function Register() {
  const router = useRouter();
  const { signUp } = useAuth();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password || !name) {
      setErr("Email, name and password are required");
      return;
    }
    if (password.length < 6) {
      setErr("Password must be at least 6 characters");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      await signUp(email.trim(), password, name.trim(), phone.trim() || undefined);
      router.replace("/verify-id");
    } catch (e: any) {
      setErr(e.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
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

            {err ? <Text style={styles.err} testID="register-error">{err}</Text> : null}

            <TouchableOpacity
              testID="register-submit"
              onPress={onSubmit}
              disabled={loading}
              style={[brutal.buttonPrimary, loading && { opacity: 0.6 }]}
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
  title: { fontSize: 36, fontWeight: "800", color: colors.text, letterSpacing: -1.2, marginTop: 16, lineHeight: 40 },
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
});
