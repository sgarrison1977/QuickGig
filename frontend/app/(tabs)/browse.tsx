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
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import { Search, MapPin, Star, ShieldCheck, SlidersHorizontal } from "lucide-react-native";
import { api, CATEGORIES, categoryMeta } from "../../src/api";
import { colors, brutal, shadows } from "../../src/theme";

const RADIUS_OPTIONS = [5, 10, 25, 50, 100];

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
        setLocStatus("Location denied — distance filter disabled");
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
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={styles.tag}>FIND WORK</Text>
          <Text style={styles.title}>Gigs Nearby</Text>
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={styles.searchBox}>
          <Search size={18} color={colors.textSecondary} strokeWidth={2.2} />
          <TextInput
            testID="search-input"
            value={q}
            onChangeText={setQ}
            placeholder="Search jobs..."
            placeholderTextColor={colors.textDisabled}
            style={styles.searchInput}
            onSubmitEditing={load}
            returnKeyType="search"
          />
        </View>
        <TouchableOpacity testID="refresh-btn" onPress={load} style={styles.filterBtn}>
          <SlidersHorizontal size={18} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip
          label="All"
          active={category === "all"}
          onPress={() => setCategory("all")}
          tint={colors.text}
          activeText="#fff"
        />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={`${c.emoji} ${c.label}`}
            active={category === c.key}
            onPress={() => setCategory(c.key)}
            tint={c.color}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip
          label="Any distance"
          active={radius === null}
          onPress={() => setRadius(null)}
          tint={colors.surfaceAlt}
        />
        {RADIUS_OPTIONS.map((r) => (
          <Chip
            key={r}
            label={`Within ${r}mi`}
            active={radius === r}
            onPress={async () => {
              if (!coords) await ensureLocation();
              setRadius(r);
            }}
            tint={colors.secondarySoft}
            activeBg={colors.secondary}
            activeText="#fff"
          />
        ))}
      </ScrollView>

      {locStatus ? <Text style={styles.locStatus}>{locStatus}</Text> : null}

      {loading && jobs.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
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
          ListEmptyComponent={
            <View style={styles.empty} testID="empty-state">
              <Text style={styles.emptyTitle}>No gigs found</Text>
              <Text style={styles.emptyDesc}>Try a different category, distance, or search term.</Text>
            </View>
          }
          renderItem={({ item }) => <JobCard job={item} onPress={() => router.push(`/job/${item.id}`)} />}
        />
      )}
    </SafeAreaView>
  );
}

function Chip({ label, active, onPress, tint, activeBg, activeText }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? (activeBg || tint) : colors.surface, borderColor: active ? "transparent" : colors.border },
      ]}
      activeOpacity={0.85}
    >
      <Text
        style={[
          styles.chipText,
          { color: active ? (activeText || colors.text) : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </TouchableOpacity>
  );
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
          <View style={styles.distRow}>
            <MapPin size={12} color={colors.textSecondary} strokeWidth={2.2} />
            <Text style={styles.distText}>{job.distance_miles} mi</Text>
          </View>
        ) : null}
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: "row" },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: colors.textSecondary },
  title: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -1, marginTop: 2 },
  searchRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, paddingTop: 10 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: colors.surface,
    borderRadius: 14,
    paddingHorizontal: 14,
    gap: 8,
    ...(shadows.soft as object),
  },
  searchInput: { flex: 1, paddingVertical: 14, fontSize: 15, fontWeight: "500", color: colors.text },
  filterBtn: {
    width: 50,
    height: 50,
    backgroundColor: colors.primary,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    ...(shadows.soft as object),
  },
  chipsRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  chip: {
    borderRadius: 999,
    borderWidth: 1.5,
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipText: { fontWeight: "700", fontSize: 13 },
  locStatus: {
    color: colors.error,
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: "600",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingTop: 4, gap: 14, paddingBottom: 40 },
  empty: { padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 22, fontWeight: "800", color: colors.text },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", marginTop: 8, textAlign: "center" },
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
  cardFoot: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 6,
  },
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
  distRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  distText: { fontWeight: "700", fontSize: 12, color: colors.textSecondary },
});
