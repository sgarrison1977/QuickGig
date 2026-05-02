import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Dimensions,
} from "react-native";
import { useRouter } from "expo-router";
import { MapPin, Star, ShieldCheck, ChevronRight, Crosshair } from "lucide-react-native";
import { colors, shadows } from "./theme";
import { categoryMeta } from "./api";

// Stub for web — react-native-maps is not supported on web
let MapView: any = null;
let Marker: any = null;
let PROVIDER_GOOGLE: any = undefined;
if (Platform.OS !== "web") {
  try {
    const maps = require("react-native-maps");
    MapView = maps.default;
    Marker = maps.Marker;
    PROVIDER_GOOGLE = maps.PROVIDER_GOOGLE;
  } catch {}
}

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
  const mapRef = useRef<any>(null);

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

  // Web fallback — react-native-maps doesn't support web
  if (Platform.OS === "web" || !MapView) {
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
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
      >
        {validJobs.map((j) => {
          const cat = categoryMeta(j.category);
          const isSel = j.id === selectedId;
          return (
            <Marker
              key={j.id}
              coordinate={{ latitude: j.latitude, longitude: j.longitude }}
              onPress={() => setSelectedId(j.id)}
              tracksViewChanges={false}
              anchor={{ x: 0.5, y: 1 }}
            >
              <View
                style={[
                  styles.marker,
                  { backgroundColor: isSel ? colors.text : colors.primary },
                  j.is_boosted ? { borderWidth: 2, borderColor: colors.yellow } : null,
                ]}
              >
                <Text style={styles.markerText} numberOfLines={1}>
                  ${j.pay_amount}
                  {j.pay_type === "hourly" ? "/hr" : ""}
                </Text>
                <View
                  style={[
                    styles.markerTail,
                    { borderTopColor: isSel ? colors.text : colors.primary },
                  ]}
                />
              </View>
            </Marker>
          );
        })}
      </MapView>

      {/* Recenter button */}
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

      {/* Count pill */}
      <View style={styles.countPill} testID="map-count">
        <Text style={styles.countPillText}>
          {validJobs.length} {validJobs.length === 1 ? "job" : "jobs"}
        </Text>
      </View>

      {/* Selected job preview card */}
      {selected ? (
        <TouchableOpacity
          testID={`map-preview-${selected.id}`}
          activeOpacity={0.92}
          style={styles.preview}
          onPress={() => router.push(`/job/${selected.id}`)}
        >
          <View style={styles.previewRow}>
            <View style={[styles.previewCat, { backgroundColor: categoryMeta(selected.category).color }]}>
              <Text style={styles.previewCatText}>
                {categoryMeta(selected.category).emoji}
              </Text>
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
                    <ShieldCheck size={11} color={colors.verified} strokeWidth={2.4} fill={colors.verified} />
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

  marker: {
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 14,
    alignItems: "center",
  },
  markerText: { color: "#fff", fontWeight: "800", fontSize: 12.5, letterSpacing: -0.1 },
  markerTail: {
    position: "absolute",
    bottom: -6,
    width: 0,
    height: 0,
    borderLeftWidth: 6,
    borderRightWidth: 6,
    borderTopWidth: 7,
    borderLeftColor: "transparent",
    borderRightColor: "transparent",
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
