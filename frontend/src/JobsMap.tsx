import React, { useMemo, useRef, useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Star, ShieldCheck, ChevronRight, Crosshair } from "lucide-react-native";
import MapView, { Marker, Callout } from "react-native-maps";
import { colors, shadows } from "./theme";
import { categoryMeta } from "./api";

type Job = {
  id: string;
  title: string;
  description: string;
  category: string;
  pay_type: string;
  pay_amount: number;
  latitude: number;
  longitude: number;
  distance_miles?: number | null;
  is_boosted?: boolean;
  photos?: string[];
  poster?: {
    id: string;
    name: string;
    is_verified?: boolean;
    rating_avg: number;
    rating_count: number;
  };
};

type Props = {
  jobs: Job[];
  coords: { lat: number; lng: number } | null;
};

export function JobsMap({ jobs, coords }: Props) {
  const router = useRouter();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [tracking, setTracking] = useState<boolean>(true);
  const mapRef = useRef<any>(null);

  // Disable tracksViewChanges shortly after first render so markers stay sharp
  // but render correctly (Android bug: false-from-start = blank/tiny marker).
  React.useEffect(() => {
    const t = setTimeout(() => setTracking(false), 1500);
    return () => clearTimeout(t);
  }, [jobs.length]);

  const validJobs = useMemo(
    () =>
      jobs.filter(
        (j) =>
          typeof j.latitude === "number" &&
          typeof j.longitude === "number" &&
          !isNaN(j.latitude) &&
          !isNaN(j.longitude)
      ),
    [jobs]
  );

  const initialRegion = useMemo(() => {
    const lat = coords?.lat ?? validJobs[0]?.latitude ?? 39.5;
    const lng = coords?.lng ?? validJobs[0]?.longitude ?? -98.35;
    return {
      latitude: lat,
      longitude: lng,
      latitudeDelta: coords ? 0.2 : 30,
      longitudeDelta: coords ? 0.2 : 30,
    };
  }, [coords, validJobs]);

  const selected = validJobs.find((j) => j.id === selectedId);

  const recenter = () => {
    if (coords && mapRef.current?.animateToRegion) {
      mapRef.current.animateToRegion(
        {
          latitude: coords.lat,
          longitude: coords.lng,
          latitudeDelta: 0.1,
          longitudeDelta: 0.1,
        },
        500
      );
    }
  };

  return (
    <View style={styles.wrap} testID="jobs-map">
      <MapView
        ref={mapRef}
        style={StyleSheet.absoluteFill}
        initialRegion={initialRegion}
        showsUserLocation={!!coords}
        showsMyLocationButton={false}
        showsCompass={false}
        toolbarEnabled={false}
      >
        {validJobs.map((j) => {
          const isSel = j.id === selectedId;
          const priceLabel = `$${j.pay_amount}${j.pay_type === "hourly" ? "/hr" : ""}`;
          // Use the native pin: it's a single bitmap, always renders, never clipped.
          // We tint it with `pinColor` (coral for normal, dark for selected, yellow for boosted).
          let pinColor = colors.primary;
          if (isSel) pinColor = colors.text;
          else if (j.is_boosted) pinColor = colors.yellow;
          return (
            <Marker
              key={j.id}
              identifier={j.id}
              coordinate={{ latitude: j.latitude, longitude: j.longitude }}
              onPress={() => setSelectedId(j.id)}
              pinColor={pinColor}
              title={priceLabel}
              description={j.title}
            />
          );
        })}
      </MapView>

      {coords ? (
        <TouchableOpacity
          testID="map-recenter"
          style={styles.recenterBtn}
          onPress={recenter}
          activeOpacity={0.85}
        >
          <Crosshair size={18} color={colors.text} strokeWidth={2.6} />
        </TouchableOpacity>
      ) : null}

      <View style={styles.countPill} testID="map-count">
        <Text style={styles.countPillText}>
          {validJobs.length} {validJobs.length === 1 ? "job" : "jobs"}
        </Text>
      </View>

      {selected ? (
        <TouchableOpacity
          testID={`map-preview-${selected.id}`}
          activeOpacity={0.92}
          style={styles.preview}
          onPress={() => router.push(`/job/${selected.id}`)}
        >
          <View style={styles.previewRow}>
            <View
              style={[
                styles.previewCat,
                { backgroundColor: categoryMeta(selected.category).color },
              ]}
            >
              <Text style={styles.previewCatText}>{categoryMeta(selected.category).emoji}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={styles.previewTitle} numberOfLines={1}>
                {selected.title}
              </Text>
              <View style={styles.previewMetaRow}>
                {selected.distance_miles != null ? (
                  <View style={styles.previewMeta}>
                    <MapPin size={11} color={colors.textSecondary} strokeWidth={2.4} />
                    <Text style={styles.previewMetaText}>{selected.distance_miles} mi</Text>
                  </View>
                ) : null}
                {selected.poster?.is_verified ? (
                  <View style={styles.previewMeta}>
                    <ShieldCheck
                      size={11}
                      color={colors.verified}
                      strokeWidth={2.4}
                      fill={colors.verified}
                    />
                    <Text style={styles.previewMetaText}>Verified</Text>
                  </View>
                ) : null}
                {selected.poster && selected.poster.rating_count > 0 ? (
                  <View style={styles.previewMeta}>
                    <Star size={11} color={colors.yellow} fill={colors.yellow} strokeWidth={0} />
                    <Text style={styles.previewMetaText}>
                      {selected.poster.rating_avg.toFixed(1)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
            <View style={styles.previewPay}>
              <Text style={styles.previewPayNum}>${selected.pay_amount}</Text>
              <Text style={styles.previewPayUnit}>
                {selected.pay_type === "hourly" ? "/hr" : "flat"}
              </Text>
            </View>
            <ChevronRight size={20} color={colors.text} strokeWidth={2.6} />
          </View>
        </TouchableOpacity>
      ) : null}

      {validJobs.length === 0 ? (
        <View style={styles.emptyOverlay} pointerEvents="none">
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>No jobs on the map</Text>
            <Text style={styles.emptySub}>Try widening your distance filter.</Text>
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: colors.surfaceAlt },

  // Marker — bigger, bolder, glanceable from across the screen.
  // Fixed dimensions are critical: react-native-maps captures the View as a
  // bitmap and re-using it across zooms only works reliably with a stable size.
  markerOuter: { alignItems: "center", width: 110, paddingBottom: 4 },
  marker: {
    width: 96,
    height: 38,
    paddingHorizontal: 8,
    borderRadius: 19,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 3,
    borderColor: "#fff",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 8,
  },
  markerSelected: {
    transform: [{ scale: 1.12 }],
    borderColor: colors.yellow,
    borderWidth: 3,
  },
  markerBoosted: {
    borderColor: colors.yellow,
    borderWidth: 3,
  },
  markerText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 14,
    letterSpacing: -0.2,
    textShadowColor: "rgba(0,0,0,0.35)",
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
  },
  markerTail: {
    width: 0,
    height: 0,
    borderLeftWidth: 8,
    borderRightWidth: 8,
    borderTopWidth: 10,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
    marginTop: -2,
  },
  markerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginTop: 2,
    borderWidth: 2,
    borderColor: "#fff",
  },

  recenterBtn: {
    position: "absolute",
    top: 14,
    right: 14,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
    ...(shadows.soft as object),
  },

  countPill: {
    position: "absolute",
    top: 14,
    left: 14,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: "#fff",
    ...(shadows.soft as object),
  },
  countPillText: { fontWeight: "800", fontSize: 12.5, color: colors.text },

  preview: {
    position: "absolute",
    left: 14,
    right: 14,
    bottom: 18,
    padding: 14,
    borderRadius: 20,
    backgroundColor: "#fff",
    ...(shadows.lift as object),
  },
  previewRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  previewCat: {
    width: 46,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
  },
  previewCatText: { fontSize: 22 },
  previewTitle: { fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  previewMetaRow: { flexDirection: "row", gap: 10, marginTop: 3, flexWrap: "wrap" },
  previewMeta: { flexDirection: "row", alignItems: "center", gap: 3 },
  previewMetaText: { fontSize: 11.5, fontWeight: "700", color: colors.textSecondary },
  previewPay: { alignItems: "flex-end" },
  previewPayNum: { fontSize: 18, fontWeight: "900", color: colors.primary, letterSpacing: -0.5 },
  previewPayUnit: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  emptyOverlay: {
    position: "absolute",
    top: 70,
    left: 0,
    right: 0,
    alignItems: "center",
  },
  emptyCard: {
    backgroundColor: "#fff",
    paddingHorizontal: 22,
    paddingVertical: 14,
    borderRadius: 16,
    ...(shadows.soft as object),
  },
  emptyTitle: { fontWeight: "800", color: colors.text, fontSize: 14, textAlign: "center" },
  emptySub: { color: colors.textSecondary, fontSize: 12, marginTop: 3, textAlign: "center" },
});
