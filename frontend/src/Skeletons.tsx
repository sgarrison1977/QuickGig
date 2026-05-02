import React, { useEffect, useRef } from "react";
import { Animated, View, StyleSheet, Easing } from "react-native";
import { colors, shadows } from "./theme";

/**
 * Animated shimmer skeleton block. Use as a loading placeholder while data
 * is fetching. Pass `style` to size it.
 */
export function Skeleton({ style }: { style?: any }) {
  const opacity = useRef(new Animated.Value(0.4)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 0.85,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.4,
          duration: 700,
          easing: Easing.inOut(Easing.quad),
          useNativeDriver: true,
        }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <Animated.View
      style={[
        { backgroundColor: "#E5E7EB", borderRadius: 8, opacity },
        style,
      ]}
    />
  );
}

/** Job card skeleton — matches the real card's layout closely */
export function JobCardSkeleton() {
  return (
    <View style={styles.card}>
      <Skeleton style={{ height: 120, marginBottom: 12, borderRadius: 14 }} />
      <View style={styles.row}>
        <Skeleton style={{ width: 56, height: 56, borderRadius: 14 }} />
        <View style={{ flex: 1, gap: 7 }}>
          <Skeleton style={{ height: 16, width: "75%", borderRadius: 6 }} />
          <Skeleton style={{ height: 12, width: "40%", borderRadius: 6 }} />
        </View>
        <View style={{ alignItems: "flex-end", gap: 6 }}>
          <Skeleton style={{ width: 60, height: 22, borderRadius: 6 }} />
          <Skeleton style={{ width: 35, height: 10, borderRadius: 6 }} />
        </View>
      </View>
      <View style={{ marginTop: 12, gap: 6 }}>
        <Skeleton style={{ height: 11, width: "92%", borderRadius: 6 }} />
        <Skeleton style={{ height: 11, width: "70%", borderRadius: 6 }} />
      </View>
    </View>
  );
}

export function JobListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 12 }}>
      {Array.from({ length: count }).map((_, i) => (
        <JobCardSkeleton key={i} />
      ))}
    </View>
  );
}

/** Conversation row skeleton for the messages tab */
export function ConvoRowSkeleton() {
  return (
    <View style={styles.convoRow}>
      <Skeleton style={{ width: 50, height: 50, borderRadius: 25 }} />
      <View style={{ flex: 1, gap: 7 }}>
        <Skeleton style={{ height: 14, width: "55%", borderRadius: 6 }} />
        <Skeleton style={{ height: 11, width: "85%", borderRadius: 6 }} />
      </View>
    </View>
  );
}

export function ConvoListSkeleton({ count = 4 }: { count?: number }) {
  return (
    <View style={{ gap: 8 }}>
      {Array.from({ length: count }).map((_, i) => (
        <ConvoRowSkeleton key={i} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: "#fff",
    padding: 14,
    borderRadius: 20,
    ...(shadows.soft as object),
  },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  convoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    backgroundColor: "#fff",
    borderRadius: 16,
    ...(shadows.soft as object),
  },
});
