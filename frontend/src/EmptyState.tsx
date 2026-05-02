import React from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { colors } from "./theme";

type Props = {
  emoji: string;
  title: string;
  subtitle?: string;
  ctaLabel?: string;
  onCtaPress?: () => void;
  testID?: string;
};

export function EmptyState({ emoji, title, subtitle, ctaLabel, onCtaPress, testID }: Props) {
  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.emojiCircle}>
        <Text style={styles.emoji} allowFontScaling={false}>
          {emoji}
        </Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      {subtitle ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      {ctaLabel && onCtaPress ? (
        <TouchableOpacity onPress={onCtaPress} activeOpacity={0.85} style={styles.cta}>
          <Text style={styles.ctaText}>{ctaLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 24,
    paddingVertical: 36,
    gap: 10,
  },
  emojiCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 6,
  },
  emoji: { fontSize: 50 },
  title: {
    fontSize: 18,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
    textAlign: "center",
  },
  subtitle: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 320,
  },
  cta: {
    marginTop: 12,
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 14,
    backgroundColor: colors.primary,
  },
  ctaText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
});
