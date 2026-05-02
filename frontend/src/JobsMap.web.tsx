import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import { colors } from "./theme";

type Props = { jobs: any[]; coords: any };

export function JobsMap(_props: Props) {
  return (
    <View style={styles.webFallback} testID="map-web-fallback">
      <MapPin size={48} color={colors.primary} strokeWidth={2.2} />
      <Text style={styles.webTitle}>Map view is mobile-only</Text>
      <Text style={styles.webSub}>
        Open QuickGig on your phone to see jobs on a map. The list view works everywhere.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  webFallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
  },
  webTitle: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  webSub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },
});
