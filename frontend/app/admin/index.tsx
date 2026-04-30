import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Lock } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function AdminLogin() {
  const router = useRouter();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("admin@quickgig.app");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    setLoading(true);
    setErr(null);
    try {
      const u = await signIn(email.trim(), password);
      if (u.role !== "admin") {
        setErr("This account is not an admin");
        return;
      }
      router.replace("/admin/dashboard");
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

          <View style={styles.iconBox}>
            <Lock size={32} color="#000" strokeWidth={2.5} />
          </View>

          <Text style={styles.title}>Admin Panel</Text>
          <Text style={styles.subtitle}>Restricted access. Sign in with admin credentials.</Text>

          <Text style={brutal.caption}>Email</Text>
          <TextInput
            testID="admin-email"
            value={email}
            onChangeText={setEmail}
            autoCapitalize="none"
            keyboardType="email-address"
            style={brutal.input}
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={brutal.caption}>Password</Text>
          <TextInput
            testID="admin-password"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
            placeholder="••••••••"
            style={brutal.input}
            placeholderTextColor={colors.textDisabled}
          />

          {err ? <Text style={styles.err}>{err}</Text> : null}

          <TouchableOpacity
            testID="admin-login-submit"
            style={[brutal.buttonPrimary, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            <Text style={brutal.buttonText}>{loading ? "Signing in..." : "Sign In as Admin"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 12 },
  back: {
    width: 44,
    height: 44,
    borderWidth: 2,
    borderColor: "#000",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  iconBox: {
    width: 64,
    height: 64,
    backgroundColor: colors.error,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    marginTop: 12,
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  title: { fontSize: 36, fontWeight: "900", color: "#000", letterSpacing: -1.5, marginTop: 8 },
  subtitle: { color: colors.textSecondary, fontWeight: "600", marginBottom: 8 },
  err: {
    color: "#fff",
    backgroundColor: colors.error,
    padding: 10,
    borderWidth: 2,
    borderColor: "#000",
    fontWeight: "700",
  },
});
