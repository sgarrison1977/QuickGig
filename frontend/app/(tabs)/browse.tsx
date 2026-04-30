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
import { Search, MapPin, Star, Filter, ShieldCheck } from "lucide-react-native";
import { api, CATEGORIES, categoryMeta } from "../../src/api";
import { colors, brutal } from "../../src/theme";

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
          <Search size={18} color="#000" strokeWidth={2.5} />
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
          <Filter size={20} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip
          label="All"
          active={category === "all"}
          onPress={() => setCategory("all")}
          color={colors.text}
          textColor="#fff"
        />
        {CATEGORIES.map((c) => (
          <Chip
            key={c.key}
            label={`${c.emoji} ${c.label}`}
            active={category === c.key}
            onPress={() => setCategory(c.key)}
            color={c.color}
          />
        ))}
      </ScrollView>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chipsRow}>
        <Chip
          label="Any distance"
          active={radius === null}
          onPress={() => setRadius(null)}
          color={colors.borderLight}
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
            color={colors.secondary}
          />
        ))}
      </ScrollView>

      {locStatus ? <Text style={styles.locStatus}>{locStatus}</Text> : null}

      {loading && jobs.length === 0 ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color="#000" />
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
              tintColor="#000"
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

function Chip({ label, active, onPress, color, textColor }: any) {
  return (
    <TouchableOpacity
      onPress={onPress}
      style={[
        styles.chip,
        { backgroundColor: active ? color : "#fff" },
      ]}
    >
      <Text style={[styles.chipText, active && { color: textColor || "#000" }]}>{label}</Text>
    </TouchableOpacity>
  );
}

export function JobCard({ job, onPress }: any) {
  const cat = categoryMeta(job.category);
  return (
    <TouchableOpacity testID={`job-card-${job.id}`} onPress={onPress} style={[brutal.card, styles.jobCard]}>
      <View style={[styles.catTag, { backgroundColor: cat.color }]}>
        <Text style={styles.catTagText}>
          {cat.emoji} {cat.label}
        </Text>
      </View>

      <Text style={styles.jobTitle}>{job.title}</Text>
      <Text style={styles.jobDesc} numberOfLines={2}>
        {job.description}
      </Text>

      <View style={styles.row}>
        <View style={[styles.payBox, { backgroundColor: colors.yellow }]}>
          <Text style={styles.payText}>
            ${job.pay_amount}
            <Text style={styles.payUnit}>{job.pay_type === "hourly" ? "/hr" : " flat"}</Text>
          </Text>
        </View>
        {job.distance_miles != null ? (
          <View style={styles.distRow}>
            <MapPin size={14} color="#000" strokeWidth={2.5} />
            <Text style={styles.distText}>{job.distance_miles} mi</Text>
          </View>
        ) : null}
      </View>

      {job.poster ? (
        <View style={styles.posterRow}>
          <View style={styles.avatarSm}>
            <Text style={styles.avatarText}>{(job.poster.name || "?").charAt(0).toUpperCase()}</Text>
          </View>
          <Text style={styles.posterName}>{job.poster.name}</Text>
          {job.poster.is_verified ? (
            <View style={styles.verBadge}>
              <ShieldCheck size={11} color="#fff" strokeWidth={3} />
            </View>
          ) : null}
          {job.poster.rating_count > 0 ? (
            <View style={styles.ratingRow}>
              <Star size={12} color="#000" fill="#000" strokeWidth={2} />
              <Text style={styles.ratingText}>{job.poster.rating_avg.toFixed(1)}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4, flexDirection: "row" },
  tag: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.textSecondary },
  title: { fontSize: 32, fontWeight: "900", color: "#000", letterSpacing: -1.5 },
  searchRow: { flexDirection: "row", paddingHorizontal: 20, gap: 10, paddingTop: 8 },
  searchBox: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 12,
    gap: 8,
  },
  searchInput: { flex: 1, paddingVertical: 12, fontSize: 15, fontWeight: "600", color: "#000" },
  filterBtn: {
    width: 48,
    height: 48,
    backgroundColor: colors.yellow,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  chipsRow: { paddingHorizontal: 20, gap: 8, paddingVertical: 8 },
  chip: {
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 14,
    paddingVertical: 8,
    marginRight: 8,
  },
  chipText: { fontWeight: "800", fontSize: 13, color: "#000", textTransform: "uppercase", letterSpacing: 0.3 },
  locStatus: {
    color: colors.error,
    paddingHorizontal: 20,
    fontSize: 12,
    fontWeight: "700",
  },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, paddingTop: 8, gap: 14, paddingBottom: 40 },
  empty: { padding: 32, alignItems: "center" },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: "#000" },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", marginTop: 8, textAlign: "center" },
  jobCard: { gap: 8 },
  catTag: {
    alignSelf: "flex-start",
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  catTagText: { fontWeight: "900", fontSize: 11, color: "#000", textTransform: "uppercase" },
  jobTitle: { fontSize: 19, fontWeight: "900", color: "#000", letterSpacing: -0.5, marginTop: 4 },
  jobDesc: { color: colors.textSecondary, fontWeight: "500", fontSize: 14 },
  row: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: 6 },
  payBox: { borderWidth: 2, borderColor: "#000", paddingHorizontal: 10, paddingVertical: 4 },
  payText: { fontWeight: "900", fontSize: 18, color: "#000" },
  payUnit: { fontSize: 12, fontWeight: "700" },
  distRow: { flexDirection: "row", alignItems: "center", gap: 4 },
  distText: { fontWeight: "800", fontSize: 13, color: "#000" },
  posterRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8 },
  avatarSm: {
    width: 28,
    height: 28,
    backgroundColor: colors.purple,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "900", color: "#000" },
  posterName: { fontWeight: "700", color: "#000", flex: 1 },
  verBadge: {
    backgroundColor: colors.verified,
    borderWidth: 1.5,
    borderColor: "#000",
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 3 },
  ratingText: { fontWeight: "800", fontSize: 13, color: "#000" },
});
