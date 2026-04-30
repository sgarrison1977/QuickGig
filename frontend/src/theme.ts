import { StyleSheet, Platform } from "react-native";

export const colors = {
  // Backgrounds
  bg: "#F7F8FC",
  surface: "#FFFFFF",
  surfaceAlt: "#F2F4FA",

  // Brand
  primary: "#FF5A5F",          // vibrant coral
  primaryDark: "#E63946",
  primarySoft: "#FFE9EA",

  secondary: "#0EBE9F",        // teal
  secondarySoft: "#D6F5EE",

  accent: "#7C5CFF",            // purple
  accentSoft: "#ECE6FF",

  yellow: "#FFC93C",
  yellowSoft: "#FFF3CC",

  orange: "#FF9F1C",

  // Text
  text: "#0E1230",
  textSecondary: "#5A6079",
  textDisabled: "#9CA3B0",

  // Borders
  border: "#E5E8F0",
  borderSoft: "#EFF1F7",

  // Status
  success: "#0EBE9F",
  warning: "#FF9F1C",
  error: "#EF4444",
  verified: "#3A86FF",

  // Misc
  shadow: "rgba(14, 18, 48, 0.08)",
  shadowLg: "rgba(14, 18, 48, 0.12)",
};

const softShadow = Platform.select({
  ios: {
    shadowColor: "#0E1230",
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
  },
  android: { elevation: 4 },
  default: {},
});

const liftShadow = Platform.select({
  ios: {
    shadowColor: "#0E1230",
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.14,
    shadowRadius: 28,
  },
  android: { elevation: 8 },
  default: {},
});

const buttonShadow = Platform.select({
  ios: {
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.28,
    shadowRadius: 18,
  },
  android: { elevation: 6 },
  default: {},
});

// `brutal` name kept for compatibility; styles are now modern soft cards.
export const brutal = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 18,
    ...softShadow,
  },
  cardLarge: {
    backgroundColor: colors.surface,
    borderRadius: 22,
    padding: 22,
    ...liftShadow,
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    ...buttonShadow,
  },
  buttonSecondary: {
    backgroundColor: colors.text,
    borderRadius: 16,
    paddingVertical: 16,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonOutline: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 15,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  buttonTextDark: {
    color: colors.text,
    fontWeight: "700",
    fontSize: 15,
    letterSpacing: 0.2,
  },
  input: {
    backgroundColor: colors.surface,
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    paddingVertical: 14,
    paddingHorizontal: 16,
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
  },
  badge: {
    backgroundColor: colors.secondarySoft,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  badgeText: {
    color: colors.secondary,
    fontWeight: "700",
    fontSize: 11,
    letterSpacing: 0.3,
  },
  h1: {
    fontSize: 34,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.8,
  },
  h2: {
    fontSize: 26,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.4,
  },
  h3: {
    fontSize: 19,
    fontWeight: "700",
    color: colors.text,
  },
  body: {
    fontSize: 15,
    color: colors.text,
    fontWeight: "500",
    lineHeight: 22,
  },
  caption: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    letterSpacing: 0.4,
    textTransform: "uppercase",
  },
});

export const shadows = { soft: softShadow, lift: liftShadow };
