import { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { useRouter, useLocalSearchParams } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ArrowLeft, Check, Sparkles, ShieldCheck, Star, Zap, Crown } from "lucide-react-native";
import { api } from "../src/api";
import { useAuth } from "../src/auth";
import { colors, brutal } from "../src/theme";

export default function Upgrade() {
  const router = useRouter();
  const { focus } = useLocalSearchParams<{ focus?: string }>();
  const { user, setUser, refresh } = useAuth();
  const [busy, setBusy] = useState<string | null>(null);

  if (!user) return null;

  const subscribePro = async () => {
    setBusy("pro");
    try {
      const u = await api("/billing/subscribe-pro", { method: "POST" });
      setUser(u);
      await refresh();
      Alert.alert("You're Pro now! 👑", "Pro is active for 30 days. (Demo — no real charge.)");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  };

  const cancelPro = async () => {
    Alert.alert("Cancel Pro?", "You'll lose the Pro badge and priority placement.", [
      { text: "Keep Pro" },
      {
        text: "Cancel",
        style: "destructive",
        onPress: async () => {
          setBusy("pro-cancel");
          try {
            const u = await api("/billing/cancel-pro", { method: "POST" });
            setUser(u);
            await refresh();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setBusy(null);
          }
        },
      },
    ]);
  };

  const buyBgCheck = async () => {
    setBusy("bg");
    try {
      const u = await api("/billing/background-check", { method: "POST" });
      setUser(u);
      await refresh();
      Alert.alert("Background-checked! ✅", "Your profile now shows the upgraded safety badge. (Demo — no real charge.)");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(null);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          testID="back-btn"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/profile"))}
          style={styles.back}
        >
          <ArrowLeft size={22} color={colors.text} strokeWidth={2.5} />
        </TouchableOpacity>

        <Text style={styles.header}>Upgrade your{"\n"}QuickGig</Text>
        <Text style={styles.sub}>Stand out. Earn more trust. Win more jobs.</Text>

        <View style={styles.demoBanner}>
          <Sparkles size={12} color={colors.warning} strokeWidth={2.5} />
          <Text style={styles.demoText}>Demo mode — purchases are mocked (no real charge)</Text>
        </View>

        {/* Pro Worker */}
        <View style={[styles.card, { backgroundColor: "transparent", padding: 0 }]}>
          <LinearGradient
            colors={["#7C5CFF", "#FF5A5F"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.gradCard}
          >
            <View style={styles.cardHead}>
              <View style={styles.iconCircle}>
                <Crown size={22} color="#fff" strokeWidth={2.4} />
              </View>
              <Text style={styles.cardTitle}>Pro Worker</Text>
              <View style={styles.priceTag}>
                <Text style={styles.price}>$4.99</Text>
                <Text style={styles.priceSub}>/ month</Text>
              </View>
            </View>
            <Bullet text="Priority placement in search results" />
            <Bullet text="Gold 'PRO' ring around your avatar" />
            <Bullet text='"Available now" status on your profile' />
            <Bullet text="Cancel anytime, keeps running 30 days" />

            {user.is_pro ? (
              <View style={{ gap: 8, marginTop: 14 }}>
                <View style={styles.activeBanner}>
                  <Check size={16} color="#fff" strokeWidth={3} />
                  <Text style={styles.activeText}>Pro Active</Text>
                </View>
                <TouchableOpacity
                  testID="cancel-pro"
                  onPress={cancelPro}
                  style={styles.cancelBtn}
                  activeOpacity={0.85}
                  disabled={busy === "pro-cancel"}
                >
                  <Text style={styles.cancelBtnText}>
                    {busy === "pro-cancel" ? "Cancelling..." : "Cancel Pro"}
                  </Text>
                </TouchableOpacity>
              </View>
            ) : (
              <TouchableOpacity
                testID="subscribe-pro"
                onPress={subscribePro}
                style={styles.ctaBtn}
                activeOpacity={0.9}
                disabled={busy === "pro"}
              >
                {busy === "pro" ? (
                  <ActivityIndicator color={colors.text} />
                ) : (
                  <>
                    <Zap size={16} color={colors.text} strokeWidth={2.6} />
                    <Text style={styles.ctaText}>Go Pro — $4.99/mo</Text>
                  </>
                )}
              </TouchableOpacity>
            )}
          </LinearGradient>
        </View>

        {/* Background Check */}
        <View style={[styles.card, { backgroundColor: colors.text }]}>
          <View style={styles.cardHead}>
            <View style={[styles.iconCircle, { backgroundColor: colors.secondary }]}>
              <ShieldCheck size={22} color="#fff" strokeWidth={2.4} />
            </View>
            <Text style={[styles.cardTitle, { color: "#fff" }]}>Background Check</Text>
            <View style={styles.priceTag}>
              <Text style={styles.price}>$10</Text>
              <Text style={styles.priceSub}>one-time</Text>
            </View>
          </View>
          <BulletDark text="Premium teal 'Background Checked' badge" />
          <BulletDark text="Stacks on top of your free ID-Verified badge" />
          <BulletDark text="Dramatically increases acceptance rates" />
          <BulletDark text="Valid forever — pay once" />

          {user.has_background_check ? (
            <View style={[styles.activeBanner, { marginTop: 14, backgroundColor: colors.secondary }]}>
              <ShieldCheck size={16} color="#fff" strokeWidth={3} />
              <Text style={styles.activeText}>Background Checked ✓</Text>
            </View>
          ) : (
            <TouchableOpacity
              testID="buy-bg"
              onPress={buyBgCheck}
              style={[styles.ctaBtn, { backgroundColor: colors.secondary }]}
              activeOpacity={0.9}
              disabled={busy === "bg"}
            >
              {busy === "bg" ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <ShieldCheck size={16} color="#fff" strokeWidth={2.6} />
                  <Text style={[styles.ctaText, { color: "#fff" }]}>Get Checked — $10</Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        <Text style={styles.footerNote}>
          ✨ The free ID-verified badge stays on every profile. These upgrades are extras, not replacements.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Check size={14} color="#fff" strokeWidth={3} />
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

function BulletDark({ text }: { text: string }) {
  return (
    <View style={styles.bullet}>
      <Check size={14} color={colors.secondary} strokeWidth={3} />
      <Text style={[styles.bulletText, { color: "rgba(255,255,255,0.9)" }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
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
  header: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -1,
    lineHeight: 38,
    marginTop: 12,
  },
  sub: { color: colors.textSecondary, fontWeight: "500", marginBottom: 8 },
  demoBanner: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: colors.yellowSoft,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 12,
  },
  demoText: { color: colors.warning, fontSize: 12, fontWeight: "700" },
  card: {
    borderRadius: 22,
    padding: 20,
    marginTop: 4,
    overflow: "hidden",
  },
  gradCard: { borderRadius: 22, padding: 22, gap: 4 },
  cardHead: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 10, flexWrap: "wrap" },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  cardTitle: { fontSize: 22, fontWeight: "800", color: "#fff", flex: 1, letterSpacing: -0.4 },
  priceTag: { alignItems: "flex-end" },
  price: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  priceSub: { fontSize: 11, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  bullet: { flexDirection: "row", alignItems: "center", gap: 10, marginVertical: 3 },
  bulletText: { color: "#fff", fontWeight: "500", fontSize: 14, flex: 1 },
  ctaBtn: {
    marginTop: 14,
    backgroundColor: "#fff",
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  ctaText: { fontWeight: "800", color: colors.text, fontSize: 15 },
  activeBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "rgba(255,255,255,0.25)",
    paddingVertical: 10,
    borderRadius: 12,
  },
  activeText: { color: "#fff", fontWeight: "800" },
  cancelBtn: {
    paddingVertical: 10,
    alignItems: "center",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
  },
  cancelBtnText: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 13 },
  footerNote: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 8,
    textAlign: "center",
    lineHeight: 18,
  },
});
