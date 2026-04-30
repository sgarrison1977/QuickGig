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
  Alert,
} from "react-native";
import { useRouter, Link } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, LogIn } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function Login() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    if (!email || !password) {
      setErr("Please fill all fields");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const u = await signIn(email.trim(), password);
      if (!u.is_verified) router.replace("/verify-id");
      else router.replace("/(tabs)/browse");
    } catch (e: any) {
      setErr(e.message || "Login failed");
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

          <Text style={styles.title}>Welcome{"\n"}back.</Text>
          <Text style={styles.subtitle}>Sign in to keep hustling.</Text>

          <View style={styles.form}>
            <Text style={brutal.caption}>Email</Text>
            <TextInput
              testID="login-email"
              value={email}
              onChangeText={setEmail}
              placeholder="you@example.com"
              autoCapitalize="none"
              keyboardType="email-address"
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            <Text style={brutal.caption}>Password</Text>
            <TextInput
              testID="login-password"
              value={password}
              onChangeText={setPassword}
              placeholder="••••••••"
              secureTextEntry
              style={brutal.input}
              placeholderTextColor={colors.textDisabled}
            />

            {err ? <Text style={styles.err} testID="login-error">{err}</Text> : null}

            <TouchableOpacity
              testID="login-submit"
              onPress={onSubmit}
              disabled={loading}
              style={[brutal.buttonPrimary, loading && { opacity: 0.6 }]}
            >
              <LogIn size={18} color="#000" strokeWidth={3} />
              <Text style={brutal.buttonText}>{loading ? "Signing in..." : "Sign In"}</Text>
            </TouchableOpacity>

            <View style={styles.bottomRow}>
              <Text style={styles.muted}>No account?</Text>
              <Link href="/(auth)/register" testID="goto-register">
                <Text style={styles.link}> Create one</Text>
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
  container: { padding: 20, gap: 16 },
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
  title: { fontSize: 38, fontWeight: "800", color: colors.text, letterSpacing: -1.2, marginTop: 16, lineHeight: 42 },
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
