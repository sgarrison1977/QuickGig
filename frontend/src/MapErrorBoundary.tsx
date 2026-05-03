import React from "react";
import { View, Text, StyleSheet } from "react-native";
import { MapPin } from "lucide-react-native";
import { colors } from "./theme";

type State = { hasError: boolean };

/**
 * Graceful fallback around JobsMap. react-native-maps requires a Google Maps
 * API key on Android production builds. Without one, the native module throws
 * during render and would otherwise crash the entire app. This boundary
 * catches that failure and shows the same "mobile-only / map unavailable"
 * message we show on web.
 */
export class MapErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(_error: any): State {
    return { hasError: true };
  }

  componentDidCatch(error: any, info: any) {
    // eslint-disable-next-line no-console
    console.warn("[JobsMap] crashed, showing fallback:", error?.message, info);
  }

  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.fallback} testID="map-unavailable">
          <MapPin size={48} color={colors.primary} strokeWidth={2.2} />
          <Text style={styles.title}>Map isn't available right now</Text>
          <Text style={styles.sub}>
            Browse gigs in list view instead — map will return once the Android
            map key is set up for production builds.
          </Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}

const styles = StyleSheet.create({
  fallback: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    padding: 32,
    minHeight: 360,
  },
  title: { fontSize: 18, fontWeight: "800", color: colors.text, letterSpacing: -0.3 },
  sub: {
    fontSize: 13.5,
    color: colors.textSecondary,
    fontWeight: "500",
    textAlign: "center",
    lineHeight: 19,
    maxWidth: 300,
  },
});
