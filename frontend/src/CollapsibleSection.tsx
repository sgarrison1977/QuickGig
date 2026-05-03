import React, { useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  LayoutAnimation,
  Platform,
  UIManager,
} from "react-native";
import { ChevronDown } from "lucide-react-native";
import { colors, shadows } from "./theme";

if (
  Platform.OS === "android" &&
  UIManager.setLayoutAnimationEnabledExperimental
) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

type Tone = "default" | "success" | "warning" | "muted";

type Props = {
  title: string;
  count: number;
  open: boolean;
  onToggle: () => void;
  tone?: Tone;
  icon?: React.ReactNode;
  testID?: string;
  children: React.ReactNode;
};

const TONE_BG: Record<Tone, string> = {
  default: "#FFFFFF",
  success: "#ECFDF5",
  warning: "#FEF2F2",
  muted: "#F8FAFC",
};

const TONE_BADGE_BG: Record<Tone, string> = {
  default: "#F1F5F9",
  success: "#A7F3D0",
  warning: "#FECACA",
  muted: "#E2E8F0",
};

const TONE_BADGE_FG: Record<Tone, string> = {
  default: colors.text,
  success: "#065F46",
  warning: "#991B1B",
  muted: colors.textSecondary,
};

/**
 * A simple collapsible section card with an animated chevron and a
 * count pill in the header. Used on the Profile screen to organize
 * the user's jobs by status (Posted / Working / Completed / Cancelled).
 */
export function CollapsibleSection({
  title,
  count,
  open,
  onToggle,
  tone = "default",
  icon,
  testID,
  children,
}: Props) {
  const handleToggle = () => {
    LayoutAnimation.configureNext({
      duration: 220,
      create: { type: "easeInEaseOut", property: "opacity" },
      update: { type: "easeInEaseOut" },
      delete: { type: "easeInEaseOut", property: "opacity" },
    });
    onToggle();
  };

  // Smaller rotate using transform (no Animated needed since LayoutAnimation
  // already animates the height; chevron rotation is just a CSS-style flip).
  const chevronStyle = open ? styles.chevronOpen : styles.chevronClosed;

  return (
    <View
      testID={testID}
      style={[styles.card, { backgroundColor: TONE_BG[tone] }]}
    >
      <TouchableOpacity
        onPress={handleToggle}
        activeOpacity={0.85}
        style={styles.header}
        testID={testID ? `${testID}-toggle` : undefined}
      >
        <View style={styles.titleRow}>
          {icon ? <View style={styles.iconWrap}>{icon}</View> : null}
          <Text style={styles.title}>{title}</Text>
          <View
            style={[
              styles.countBadge,
              { backgroundColor: TONE_BADGE_BG[tone] },
            ]}
          >
            <Text style={[styles.countText, { color: TONE_BADGE_FG[tone] }]}>
              {count}
            </Text>
          </View>
        </View>
        <View style={chevronStyle}>
          <ChevronDown size={20} color={colors.textSecondary} strokeWidth={2.6} />
        </View>
      </TouchableOpacity>

      {open ? <View style={styles.body}>{children}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 16,
    overflow: "hidden",
    ...(shadows.soft as object),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 14,
    paddingVertical: 14,
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    flex: 1,
  },
  iconWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  title: {
    fontSize: 15.5,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  countBadge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 999,
    minWidth: 28,
    alignItems: "center",
  },
  countText: {
    fontSize: 12,
    fontWeight: "900",
    letterSpacing: 0.2,
  },
  chevronOpen: {
    transform: [{ rotate: "180deg" }],
  },
  chevronClosed: {
    transform: [{ rotate: "0deg" }],
  },
  body: {
    paddingHorizontal: 12,
    paddingBottom: 12,
    paddingTop: 4,
    gap: 10,
  },
});
