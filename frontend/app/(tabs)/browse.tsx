import { useEffect, useState, useCallback, useRef } from "react";
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
  Pressable,
  Animated,
} from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import * as Location from "expo-location";
import { Search, MapPin, Star, ShieldCheck, X, Navigation, SlidersHorizontal, List, Map as MapIcon } from "lucide-react-native";
import { api, CATEGORIES, categoryMeta } from "../../src/api";
import { colors, brutal, shadows } from "../../src/theme";
import { FiltersSheet, BrowseFilters, DEFAULT_FILTERS, countActive } from "../../src/FiltersSheet";
import { JobsMap } from "../../src/JobsMap";
import { MapErrorBoundary } from "../../src/MapErrorBoundary";
import { JobListSkeleton } from "../../src/Skeletons";
import { EmptyState } from "../../src/EmptyState";
import { UpsellBanner } from "../../src/UpsellBanner";
import { MONETIZATION_ENABLED } from "../../src/features";
import { useAuth } from "../../src/auth";

const FILTERS_STORAGE_KEY = "qg_browse_filters_v1";
const VIEW_STORAGE_KEY = "qg_browse_view_v1";

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
  const { user } = useAuth();
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [q, setQ] = useState("");
  const [category, setCategory] = useState<string>("all");
  const [radius, setRadius] = useState<number | null>(null);
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [locStatus, setLocStatus] = useState<string>("");
  const [filters, setFilters] = useState<BrowseFilters>(DEFAULT_FILTERS);
  const [showSheet, setShowSheet] = useState(false);
  const [viewMode, setViewMode] = useState<"list" | "map">("list");
  const activeCount = countActive(filters);

  // Load saved filters + view mode
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(FILTERS_STORAGE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          setFilters({ ...DEFAULT_FILTERS, ...parsed });
        }
        const v = await AsyncStorage.getItem(VIEW_STORAGE_KEY);
        if (v === "map" || v === "list") setViewMode(v);
      } catch {}
    })();
  }, []);

  // Persist whenever filters / view change
  useEffect(() => {
    AsyncStorage.setItem(FILTERS_STORAGE_KEY, JSON.stringify(filters)).catch(() => {});
  }, [filters]);

  useEffect(() => {
    AsyncStorage.setItem(VIEW_STORAGE_KEY, viewMode).catch(() => {});
  }, [viewMode]);

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
      const needsGps = !!radius || filters.sort === "near";
      const c = coords || (needsGps ? await ensureLocation() : null);
      const data = await api<any[]>("/jobs", {
        auth: true,
        query: {
          q,
          category,
          lat: c?.lat,
          lng: c?.lng,
          radius: radius && c ? radius : undefined,
          status: "open",
          pay_type: filters.pay_type !== "all" ? filters.pay_type : undefined,
          min_pay: filters.min_pay > 0 ? filters.min_pay : undefined,
          verified_only: filters.verified_only ? true : undefined,
          sort: filters.sort,
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
  }, [q, category, radius, coords, filters]);

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
      <FiltersSheet
        visible={showSheet}
        value={filters}
        hasLocation={!!coords}
        onClose={() => setShowSheet(false)}
        onApply={(f) => setFilters(f)}
      />
      <FlatList
        data={viewMode === "map" ? [] : jobs}
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

            {/* Search + Filters */}
            <View style={styles.searchBar}>
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
              <TouchableOpacity
                testID="filters-open"
                style={[styles.filterBtn, activeCount > 0 && styles.filterBtnActive]}
                onPress={() => setShowSheet(true)}
                activeOpacity={0.85}
              >
                <SlidersHorizontal
                  size={20}
                  color={activeCount > 0 ? "#fff" : colors.text}
                  strokeWidth={2.6}
                />
                <Text
                  style={[
                    styles.filterBtnLabel,
                    activeCount > 0 && { color: "#fff" },
                  ]}
                >
                  Filter
                </Text>
                {activeCount > 0 ? (
                  <View style={styles.filterBadge}>
                    <Text style={styles.filterBadgeText}>{activeCount}</Text>
                  </View>
                ) : null}
              </TouchableOpacity>
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

            {/* Eye-catching upsell — Pro Worker + Background Check */}
            {MONETIZATION_ENABLED ? (
              <UpsellBanner isPro={user?.is_pro} hasBackgroundCheck={user?.has_background_check} />
            ) : null}

            <View style={styles.resultsHead}>
              <Text style={styles.resultsTitle}>
                {jobs.length} {jobs.length === 1 ? "gig" : "gigs"} available
              </Text>
              {radius && coords ? (
                <Text style={styles.resultsSub}>within {radius} miles</Text>
              ) : null}
            </View>

            {/* Active filter chips (tap × to remove) */}
            {activeCount > 0 ? (
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.activeChipsRow}
              >
                {filters.sort !== "best" ? (
                  <ActiveChip
                    label={
                      filters.sort === "new"
                        ? "Newest"
                        : filters.sort === "pay"
                        ? "Highest pay"
                        : "Closest"
                    }
                    onClear={() => setFilters((f) => ({ ...f, sort: "best" }))}
                  />
                ) : null}
                {filters.pay_type !== "all" ? (
                  <ActiveChip
                    label={filters.pay_type === "hourly" ? "Hourly" : "Fixed pay"}
                    onClear={() => setFilters((f) => ({ ...f, pay_type: "all" }))}
                  />
                ) : null}
                {filters.min_pay > 0 ? (
                  <ActiveChip
                    label={`$${filters.min_pay}+`}
                    onClear={() => setFilters((f) => ({ ...f, min_pay: 0 }))}
                  />
                ) : null}
                {filters.verified_only ? (
                  <ActiveChip
                    label="Verified only"
                    onClear={() => setFilters((f) => ({ ...f, verified_only: false }))}
                  />
                ) : null}
                <TouchableOpacity
                  testID="clear-all-filters"
                  onPress={() => setFilters(DEFAULT_FILTERS)}
                  style={styles.clearAllChip}
                  activeOpacity={0.85}
                >
                  <Text style={styles.clearAllText}>Clear all</Text>
                </TouchableOpacity>
              </ScrollView>
            ) : null}
          </View>
        }
        ListEmptyComponent={
          viewMode === "map" ? null : loading ? (
            <View style={{ paddingTop: 6 }}>
              <JobListSkeleton count={4} />
            </View>
          ) : activeCount > 0 || q || category !== "all" || radius ? (
            <EmptyState
              testID="empty-state"
              emoji="🔍"
              title="No gigs match your filters"
              subtitle="Try widening your distance, removing filters, or clearing the search."
              ctaLabel="Clear all filters"
              onCtaPress={() => {
                setFilters(DEFAULT_FILTERS);
                setQ("");
                setCategory("all");
                setRadius(null);
              }}
            />
          ) : (
            <EmptyState
              testID="empty-state"
              emoji="✨"
              title="No gigs nearby yet"
              subtitle="Be the first to post a gig in your area, or pull down to refresh."
              ctaLabel="Post a gig"
              onCtaPress={() => router.push("/(tabs)/post")}
            />
          )
        }
        renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />}
        ItemSeparatorComponent={() => <View style={{ height: 12 }} />}
        ListFooterComponent={
          viewMode === "map" ? (
            <View style={styles.mapWrap} testID="map-container">
              <MapErrorBoundary>
                <JobsMap jobs={jobs} coords={coords} />
              </MapErrorBoundary>
            </View>
          ) : null
        }
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

function ActiveChip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <TouchableOpacity
      testID={`active-chip-${label}`}
      onPress={onClear}
      activeOpacity={0.8}
      style={styles.activeChip}
    >
      <Text style={styles.activeChipText}>{label}</Text>
      <X size={12} color="#fff" strokeWidth={2.8} />
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
  const photos: string[] = Array.isArray(job.photos) ? job.photos : [];
  const scale = useRef(new Animated.Value(1)).current;
  const onIn = () =>
    Animated.spring(scale, { toValue: 0.97, useNativeDriver: true, speed: 30, bounciness: 0 }).start();
  const onOut = () =>
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, speed: 25, bounciness: 6 }).start();
  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <Pressable
        testID={`job-card-${job.id}`}
        onPress={onPress}
        onPressIn={onIn}
        onPressOut={onOut}
        style={styles.jobCard}
      >
      {job.is_boosted ? (
        <View style={styles.boostedRibbon}>
          <Text style={styles.boostedRibbonText}>🚀  BOOSTED</Text>
        </View>
      ) : null}
      {photos.length > 0 ? (
        <View style={styles.photoPreview}>
          <ImageBackground
            source={{ uri: photos[0] }}
            style={styles.photoPreviewImg}
            imageStyle={{ borderRadius: 14 }}
          >
            {photos.length > 1 ? (
              <View style={styles.photoCountBadge}>
                <Text style={styles.photoCountText}>+{photos.length - 1}</Text>
              </View>
            ) : null}
          </ImageBackground>
        </View>
      ) : null}
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
      </Pressable>
    </Animated.View>
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

  searchBar: { flexDirection: "row", alignItems: "center", gap: 10 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 16,
    paddingHorizontal: 14,
    gap: 10,
    ...(shadows.soft as object),
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: "500", color: colors.text },
  filterBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    minWidth: 110,
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.surface,
    ...(shadows.soft as object),
  },
  filterBtnActive: { backgroundColor: colors.primary },
  filterBtnLabel: {
    color: colors.text,
    fontWeight: "800",
    fontSize: 15,
    letterSpacing: -0.2,
  },
  viewToggleBtn: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#fff",
    gap: 6,
    borderWidth: 2,
    borderColor: colors.primary,
    ...(shadows.soft as object),
  },
  viewToggleBtnActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  viewToggleText: { fontWeight: "800", fontSize: 13, color: colors.primary, letterSpacing: -0.2 },
  filterBadge: {
    position: "absolute",
    top: 4,
    right: 4,
    minWidth: 18,
    height: 18,
    paddingHorizontal: 4,
    borderRadius: 9,
    backgroundColor: colors.yellow,
    alignItems: "center",
    justifyContent: "center",
  },
  filterBadgeText: { fontWeight: "800", fontSize: 11, color: colors.text },

  activeChipsRow: { gap: 8, paddingRight: 4, paddingVertical: 2 },
  activeChip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: colors.text,
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
  },
  activeChipText: { color: "#fff", fontWeight: "700", fontSize: 12 },
  clearAllChip: {
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  clearAllText: { color: colors.primary, fontWeight: "800", fontSize: 12 },

  mapWrap: {
    height: 520,
    marginTop: 6,
    borderRadius: 20,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
  },

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
  boostedRibbon: {
    alignSelf: "flex-start",
    backgroundColor: colors.orange,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 999,
    marginBottom: 2,
  },
  boostedRibbonText: { color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.8 },
  photoPreview: {
    marginBottom: 12,
    borderRadius: 14,
    overflow: "hidden",
    backgroundColor: colors.surfaceAlt,
  },
  photoPreviewImg: {
    width: "100%",
    height: 160,
    justifyContent: "flex-end",
    alignItems: "flex-end",
    padding: 10,
  },
  photoCountBadge: {
    backgroundColor: "rgba(0,0,0,0.65)",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 999,
  },
  photoCountText: { color: "#fff", fontWeight: "800", fontSize: 12 },
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
