import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { Crown, ShieldCheck, ChevronRight, Sparkles, X } from "lucide-react-native";
import { colors, shadows } from "./theme";

type Props = {
  isPro?: boolean;
  hasBackgroundCheck?: boolean;
};

/**
 * Eye-catching upsell shown on the Browse home screen for users who
 * haven't yet bought Pro Worker or Background Check. Users can dismiss
 * the banner via the X button — but it intentionally re-appears on the
 * next app launch (session-only dismissal) so we keep monetization
 * front-and-center for new sessions.
 */
export function UpsellBanner({ isPro, hasBackgroundCheck }: Props) {
  const router = useRouter();
  // Session-only dismissal: NOT persisted. Banner returns on next app launch.
  const [dismissed, setDismissed] = useState(false);

  const showPro = !isPro;
  const showBg = !hasBackgroundCheck;

  if (dismissed) return null;
  if (!showPro && !showBg) return null;

  return (
    <View style={styles.wrap} testID="upsell-banner">
      <View style={styles.headerRow}>
        <View style={styles.eyebrowLeft}>
          <Sparkles size={14} color={colors.yellow} fill={colors.yellow} strokeWidth={0} />
          <Text style={styles.eyebrow}>STAND OUT · WIN MORE GIGS</Text>
        </View>
        <TouchableOpacity
          testID="upsell-dismiss"
          onPress={() => setDismissed(true)}
          hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          style={styles.dismissBtn}
          activeOpacity={0.7}
        >
          <X size={14} color={colors.subtext} strokeWidth={2.8} />
        </TouchableOpacity>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        snapToInterval={296}
        decelerationRate="fast"
      >
        {showPro ? (
          <TouchableOpacity
            testID="upsell-pro"
            activeOpacity={0.92}
            onPress={() => router.push("/upgrade?focus=pro")}
            style={{ marginRight: 12 }}
          >
            <LinearGradient
              colors={[colors.primary, colors.yellow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardHead}>
                <View style={styles.iconCircle}>
                  <Crown size={22} color="#fff" strokeWidth={2.6} fill="#fff" />
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceTagText}>$4.99 / mo</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>Become a Pro Worker</Text>
              <Text style={styles.cardSub}>
                Pro badge on your profile + priority placement = up to 3× more gigs accepted.
              </Text>
              <View style={styles.bullets}>
                <Bullet text="🔝  Top of search results" />
                <Bullet text="👑  Pro crown badge" />
                <Bullet text="⚡  Priority on new postings" />
              </View>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Go Pro</Text>
                <ChevronRight size={16} color={colors.text} strokeWidth={2.8} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}

        {showBg ? (
          <TouchableOpacity
            testID="upsell-bg"
            activeOpacity={0.92}
            onPress={() => router.push("/upgrade?focus=bg")}
          >
            <LinearGradient
              colors={["#10B981", "#0F766E"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.card}
            >
              <View style={styles.cardHead}>
                <View style={styles.iconCircle}>
                  <ShieldCheck size={22} color="#fff" strokeWidth={2.6} />
                </View>
                <View style={styles.priceTag}>
                  <Text style={styles.priceTagText}>$10 once</Text>
                </View>
              </View>
              <Text style={styles.cardTitle}>Get Background Checked</Text>
              <Text style={styles.cardSub}>
                Make customers feel safe hiring you. Verified workers get hired faster — and rated higher.
              </Text>
              <View style={styles.bullets}>
                <Bullet text="🛡️  Trusted-worker shield" />
                <Bullet text="🤝  Build customer trust fast" />
                <Bullet text="💼  Unlock safety-first gigs" />
              </View>
              <View style={styles.cta}>
                <Text style={styles.ctaText}>Get Verified</Text>
                <ChevronRight size={16} color={colors.text} strokeWidth={2.8} />
              </View>
            </LinearGradient>
          </TouchableOpacity>
        ) : null}
      </ScrollView>
    </View>
  );
}

function Bullet({ text }: { text: string }) {
  return (
    <View style={styles.bulletRow}>
      <Text style={styles.bulletText}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: 8, marginBottom: 6 },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 2,
  },
  eyebrowLeft: { flexDirection: "row", alignItems: "center", gap: 6 },
  eyebrow: {
    fontSize: 10.5,
    fontWeight: "900",
    color: colors.text,
    letterSpacing: 1,
  },
  dismissBtn: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(0,0,0,0.06)",
  },
  scroll: { paddingRight: 12 },
  card: {
    width: 284,
    borderRadius: 22,
    padding: 16,
    gap: 6,
    ...(shadows.lift as object),
  },
  cardHead: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 6,
  },
  iconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  priceTag: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  priceTagText: { color: "#fff", fontWeight: "900", fontSize: 12, letterSpacing: -0.2 },
  cardTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#fff",
    letterSpacing: -0.7,
    marginTop: 4,
  },
  cardSub: {
    fontSize: 13,
    color: "rgba(255,255,255,0.95)",
    fontWeight: "600",
    lineHeight: 18,
    marginBottom: 6,
  },
  bullets: { gap: 4, marginBottom: 8 },
  bulletRow: { flexDirection: "row" },
  bulletText: { color: "#fff", fontWeight: "700", fontSize: 12.5 },
  cta: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "#fff",
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 999,
    marginTop: 4,
  },
  ctaText: { color: colors.text, fontWeight: "900", fontSize: 13.5, letterSpacing: -0.2 },
});
