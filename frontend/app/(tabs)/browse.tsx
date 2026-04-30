import { useEffect, useState, useCallback } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  FlatList,
  ScrollView,
  RefreshControl,
  ActivityIndicator,
  ImageBackground,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Search, MapPin, Star, ShieldCheck, X, Navigation } from "lucide-react-native";
import { api, CATEGORIES, categoryMeta } from "../../src/api";
import { colors, brutal, shadows } from "../../src/theme";

const RADIUS_OPTIONS = [
  { value: null, label: "Any" },
  { value: 5, label: "5 mi" },
  { value: 10, label: "10 mi" },
  { value: 25, label: "25 mi" },
  { value: 50, label: "50 mi" },
  { value: 100, label: "100 mi" },
];

export default function Browse() {
  const router = useRouter();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [radius, setRadius] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<string>("");

  const ensureLocation = async () => {
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== "granted") {
        setLocStatus("Location off — enable to filter by distance");
        return null;
      }
      const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
      const c = { lat: loc.coords.latitude, lng: loc.coords.longitude };
      setCoords(c);
      setLocStatus("");
      return c;
    } catch {
      setLocStatus("Could not get location");
      return null;
    }
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const c = coords || (radius ? await ensureLocation() : null);
      const data = await api<any[]>("/jobs", {
        auth: true,
        query: {
          q,
          category,
          lat: c?.lat,
          lng: c?.lng,
          radius: radius && c ? radius : undefined,
          status: "open",
        },
      });
      setJobs(data);
    } catch (e: any) {
      console.warn(e?.message);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, category, radius, coords]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  useEffect(() => {
    ensureLocation();
  }, []);

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <FlatList
        data={jobs}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
        ListHeaderComponent={
          <View style={{ gap: 14 }}>
            {/* Hero */}
            <LinearGradient
              colors={["#FF5A5F", "#FF8A5C", "#FFC93C"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.hero}
            >
              <View>
                <Text style={styles.heroTag}>FIND WORK NEARBY</Text>
                <Text style={styles.heroTitle}>What do you{"\n"}need done today?</Text>
              </View>
            </LinearGradient>

            {/* Search */}
            <View style={styles.searchBox}>
              <Search size={18} color={colors.textSecondary} strokeWidth={2.2} />
              <TextInput
                testID="search-input"
                value={q}
                onChangeText={setQ}
                placeholder="Search gigs..."
                placeholderTextColor={colors.textDisabled}
                style={styles.searchInput}
                onSubmitEditing={load}
                returnKeyType="search"
              />
              {q ? (
                <TouchableOpacity onPress={() => setQ("")} testID="clear-search">
                  <X size={16} color={colors.textSecondary} strokeWidth={2.4} />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Categories */}
            <View>
              <Text style={styles.sectionTitle}>Categories</Text>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.catRow}
              >
                <CategoryAllChip active={category === "all"} onPress={() => setCategory("all")} />
                {CATEGORIES.map((c) => (
                  <CategoryChip
                    key={c.key}
                    cat={c}
                    active={category === c.key}
                    onPress={() => setCategory(c.key)}
                  />
                ))}
              </ScrollView>
            </View>

            {/* Distance */}
            <View>
              <View style={styles.distHead}>
                <Text style={styles.sectionTitle}>Distance</Text>
                {coords ? (
                  <View style={styles.gpsPill}>
                    <Navigation size={11} color={colors.secondary} fill={colors.secondary} strokeWidth={0} />
                    <Text style={styles.gpsPillText}>GPS ON</Text>
                  </View>
                ) : (
                  <TouchableOpacity onPress={ensureLocation} style={styles.gpsPillOff}>
                    <Navigation size={11} color={colors.textSecondary} strokeWidth={2.4} />
                    <Text style={styles.gpsPillOffText}>Enable GPS</Text>
                  </TouchableOpacity>
                )}
              </View>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.distRow}
              >
                {RADIUS_OPTIONS.map((r) => (
                  <DistancePill
                    key={String(r.value)}
                    label={r.label}
                    active={radius === r.value}
                    onPress={async () => {
                      if (r.value && !coords) await ensureLocation();
                      setRadius(r.value);
                    }}
                  />
                ))}
              </ScrollView>
              {locStatus ? <Text style={styles.locStatus}>{locStatus}</Text> : null}
            </View>

            <View style={styles.resultsHead}>
              <Text style={styles.resultsTitle}>
                {jobs.length} {jobs.length === 1 ? "gig" : "gigs"} available
              </Text>
              {radius && coords ? (
                <Text style={styles.resultsSub}>within {radius} miles</Text>
              ) : null}
            </View>
          </View>
        }
        ListEmptyComponent={
          loading ? (
            <View style={styles.loading}>
              <ActivityIndicator size="large" color={colors.primary} />
            </View>
          ) : (
            <View style={styles.empty} testID="empty-state">
              <Text style={styles.emptyTitle}>No gigs found</Text>
              <Text style={styles.emptyDesc}>Try a different category, distance, or search term.</Text>
            </View>
          )
        }
        renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
      />
    </SafeAreaView>
  );
}

function CategoryAllChip({ active, onPress }: any) {
  return (
    <TouchableOpacity
      testID="cat-all"
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.catCard, styles.catAll, active && styles.catActiveRing]}
    >
      <View style={[styles.catImage, styles.catAllImage]}>
        <Text style={styles.catAllEmoji}>✨</Text>
      </View>
      <Text style={[styles.catLabel, active && { color: colors.primary }]}>All</Text>
    </TouchableOpacity>
  );
}

function CategoryChip({ cat, active, onPress }: any) {
  return (
    <TouchableOpacity
      testID={`cat-${cat.key}`}
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.catCard, active && styles.catActiveRing]}
    >
      <ImageBackground
        source={{ uri: cat.image }}
        style={styles.catImage}
        imageStyle={{ borderRadius: 16 }}
      >
        <View style={[styles.catOverlay, { backgroundColor: hex2rgba(cat.color, 0.55) }]}>
          <Text style={styles.catEmoji}>{cat.emoji}</Text>
        </View>
      </ImageBackground>
      <Text style={[styles.catLabel, active && { color: colors.primary }]}>{cat.label}</Text>
    </TouchableOpacity>
  );
}

function DistancePill({ label, active, onPress }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.85}
      style={[styles.distPill, active && styles.distPillActive]}
    >
      <MapPin
        size={13}
        color={active ? "#fff" : colors.secondary}
        strokeWidth={2.4}
      />
      <Text style={[styles.distPillText, active && { color: "#fff" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

function hex2rgba(hex: string, a: number) {
  const h = hex.replace("#", "");
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `rgba(${r},${g},${b},${a})`;
}

export function JobCard({ job, onPress }: any) {
  const cat = categoryMeta(job.category);
  return (
    <TouchableOpacity testID={`job-card-${job.id}`} onPress={onPress} activeOpacity={0.9} style={styles.jobCard}>
      <View style={styles.cardHead}>
        <View style={[styles.catTag, { backgroundColor: cat.color }]}>
          <Text style={styles.catTagText}>
            {cat.emoji} {cat.label}
          </Text>
        </View>
        <View style={styles.payChip}>
          <Text style={styles.payChipNum}>${job.pay_amount}</Text>
          <Text style={styles.payChipUnit}>{job.pay_type === "hourly" ? "/hr" : " flat"}</Text>
        </View>
      </View>

      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobDesc} numberOfLines={2}>
        {job.description}
      </Text>

      <View style={styles.cardFoot}>
        {job.poster ? (
          <View style={styles.posterRow}>
            <View style={styles.avatarSm}>
              <Text style={styles.avatarText}>{(job.poster.name || "?").charAt(0).toUpperCase()}</Text>
            </View>
            <View>
              <View style={styles.nameRow}>
                <Text style={styles.posterName} numberOfLines={1}>{job.poster.name}</Text>
                {job.poster.is_verified ? (
                  <ShieldCheck size={13} color={colors.verified} fill={colors.verified} strokeWidth={0} />
                ) : null}
              </View>
              {job.poster.rating_count > 0 ? (
                <View style={styles.ratingRow}>
                  <Star size={11} color={colors.yellow} fill={colors.yellow} strokeWidth={0} />
                  <Text style={styles.ratingText}>{job.poster.rating_avg.toFixed(1)}</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : <View />}

        {job.distance_miles != null ? (
          <View style={styles.distMeta}>
            <MapPin size={12} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={styles.distMetaText}>{job.distance_miles} mi</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  list: { padding: 16, paddingBottom: 40 },

  hero: {
    borderRadius: 22,
    padding: 22,
    paddingVertical: 24,
    marginTop: 4,
  },
  heroTag: { fontSize: 11, color: "rgba(255,255,255,0.85)", fontWeight: "800", letterSpacing: 1.6 },
  heroTitle: { fontSize: 26, color: "#fff", fontWeight: "800", letterSpacing: -0.6, lineHeight: 30, marginTop: 6 },

  searchBox: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
    ...(shadows.soft as object),
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: "500", color: colors.text },

  sectionTitle: { fontSize: 13, fontWeight: "800", color: colors.text, letterSpacing: 0.4, marginBottom: 10, paddingHorizontal: 2 },

  catRow: { gap: 12, paddingRight: 4, paddingBottom: 4 },
  catCard: { width: 92, alignItems: "center", gap: 6 },
  catActiveRing: {},
  catImage: {
    width: 88,
    height: 88,
    borderRadius: 16,
    overflow: "hidden",
  },
  catOverlay: {
    flex: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  catEmoji: { fontSize: 34 },
  catAll: {},
  catAllImage: {
    backgroundColor: colors.text,
    alignItems: "center",
    justifyContent: "center",
  },
  catAllEmoji: { fontSize: 32 },
  catLabel: { fontSize: 12, fontWeight: "700", color: colors.text },

  distHead: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginBottom: 10 },
  gpsPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.secondarySoft,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gpsPillText: { fontSize: 10, fontWeight: "800", color: colors.secondary, letterSpacing: 0.5 },
  gpsPillOff: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
  },
  gpsPillOffText: { fontSize: 10, fontWeight: "700", color: colors.textSecondary },

  distRow: { gap: 8, paddingRight: 4 },
  distPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.secondarySoft,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  distPillActive: { backgroundColor: colors.secondary },
  distPillText: { fontWeight: "700", fontSize: 13, color: colors.secondary },

  locStatus: { color: colors.error, fontSize: 12, fontWeight: "600", marginTop: 8, paddingHorizontal: 2 },

  resultsHead: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 6, marginBottom: 4, paddingHorizontal: 2 },
  resultsTitle: { fontSize: 15, fontWeight: "800", color: colors.text },
  resultsSub: { fontSize: 12, fontWeight: "600", color: colors.textSecondary },

  loading: { padding: 60, alignItems: "center" },
  empty: { padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", marginTop: 8, textAlign: "center" },

  // Job card
  jobCard: {
    backgroundColor: colors.surface,
    borderRadius: 20,
    padding: 18,
    gap: 8,
    ...(shadows.soft as object),
  },
  cardHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  catTag: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  catTagText: { fontWeight: "700", fontSize: 11, color: colors.text },
  payChip: {
    flexDirection: "row",
    alignItems: "baseline",
    backgroundColor: colors.primarySoft,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  payChipNum: { fontSize: 17, fontWeight: "800", color: colors.primary, letterSpacing: -0.5 },
  payChipUnit: { fontSize: 11, fontWeight: "700", color: colors.primary, marginLeft: 1 },
  jobTitle: { fontSize: 18, fontWeight: "700", color: colors.text, letterSpacing: -0.3, marginTop: 4 },
  jobDesc: { color: colors.textSecondary, fontWeight: "500", fontSize: 14, lineHeight: 20 },
  cardFoot: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: 6 },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatarSm: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", color: colors.accent, fontSize: 14 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  posterName: { fontWeight: "700", color: colors.text, fontSize: 13, maxWidth: 140 },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3, marginTop: 1 },
  ratingText: { fontWeight: "700", fontSize: 12, color: colors.textSecondary },
  distMeta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  distMetaText: { fontWeight: "700", fontSize: 12, color: colors.textSecondary },
});
