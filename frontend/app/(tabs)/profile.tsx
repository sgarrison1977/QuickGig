import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { ShieldCheck, Star, LogOut, ShieldAlert, Briefcase, CheckSquare } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { colors, brutal, shadows } from "../../src/theme";
import { JobCard } from "./browse";

export default function Profile() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const [tab, setTab] = useState<"posted" | "accepted">("posted");
  const [posted, setPosted] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await api<any>("/jobs/mine");
      setPosted(r.posted);
      setAccepted(r.accepted);
      await refresh();
    } catch {}
    setRefreshing(false);
  }, [refresh]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  if (!user) return null;
  const list = tab === "posted" ? posted : accepted;

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <ScrollView
        contentContainerStyle={styles.container}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
          />
        }
      >
        <LinearGradient
          colors={["#7C5CFF", "#FF5A5F"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View style={styles.profileRow}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avatarFallback]}>
                <Text style={styles.avatarLetter}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name} numberOfLines={1}>{user.name}</Text>
                {user.is_verified ? (
                  <View style={styles.ver}>
                    <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                    <Text style={styles.verText}>VERIFIED</Text>
                  </View>
                ) : (
                  <View style={[styles.ver, { backgroundColor: "rgba(255,255,255,0.25)" }]}>
                    <ShieldAlert size={11} color="#fff" strokeWidth={3} />
                    <Text style={styles.verText}>UNVERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email} numberOfLines={1}>{user.email}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Star size={13} color="#FFD93C" fill="#FFD93C" strokeWidth={0} />
                  <Text style={styles.statText}>
                    {user.rating_count > 0 ? user.rating_avg.toFixed(1) : "—"}
                  </Text>
                  <Text style={styles.statSub}>({user.rating_count})</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.stat}>
                  <CheckSquare size={13} color="#fff" strokeWidth={2.5} />
                  <Text style={styles.statText}>{user.jobs_completed}</Text>
                  <Text style={styles.statSub}>done</Text>
                </View>
              </View>
            </View>
          </View>
        </LinearGradient>

        {!user.is_verified ? (
          <TouchableOpacity
            testID="verify-cta"
            style={brutal.buttonPrimary}
            onPress={() => router.push("/verify-id")}
            activeOpacity={0.9}
          >
            <ShieldCheck size={18} color="#fff" strokeWidth={2.6} />
            <Text style={brutal.buttonText}>Verify Your ID</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabs}>
          <TouchableOpacity
            testID="tab-posted"
            style={[styles.tab, tab === "posted" && styles.tabActive]}
            onPress={() => setTab("posted")}
            activeOpacity={0.85}
          >
            <Briefcase size={15} color={tab === "posted" ? "#fff" : colors.textSecondary} strokeWidth={2.4} />
            <Text style={[styles.tabText, tab === "posted" && styles.tabTextActive]}>Posted ({posted.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-accepted"
            style={[styles.tab, tab === "accepted" && styles.tabActive]}
            onPress={() => setTab("accepted")}
            activeOpacity={0.85}
          >
            <CheckSquare size={15} color={tab === "accepted" ? "#fff" : colors.textSecondary} strokeWidth={2.4} />
            <Text style={[styles.tabText, tab === "accepted" && styles.tabTextActive]}>Working ({accepted.length})</Text>
          </TouchableOpacity>
        </View>

        <View style={{ gap: 12 }}>
          {list.length === 0 ? (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Nothing here yet</Text>
              <Text style={styles.emptyDesc}>
                {tab === "posted"
                  ? "Post your first gig from the + tab."
                  : "Accept a job from Browse to start working."}
              </Text>
            </View>
          ) : (
            list.map((j) => <JobCard key={j.id} job={j} onPress={() => router.push(`/job/${j.id}`)} />)
          )}
        </View>

        <TouchableOpacity
          testID="logout-btn"
          style={[brutal.buttonOutline, { marginTop: 16 }]}
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/welcome");
          }}
          activeOpacity={0.85}
        >
          <LogOut size={18} color={colors.text} strokeWidth={2.4} />
          <Text style={brutal.buttonTextDark}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  heroCard: {
    borderRadius: 22,
    padding: 20,
    ...(shadows.lift as object),
  },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avatarFallback: {
    backgroundColor: "rgba(255,255,255,0.25)",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 30, fontWeight: "800", color: "#fff" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  ver: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    backgroundColor: "rgba(255,255,255,0.2)",
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  verText: { color: "#fff", fontWeight: "700", fontSize: 9, letterSpacing: 0.6 },
  email: { color: "rgba(255,255,255,0.85)", fontWeight: "500", marginTop: 2, fontSize: 13 },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 12, marginTop: 10 },
  stat: { flexDirection: "row", alignItems: "center", gap: 5 },
  statText: { fontWeight: "800", color: "#fff", fontSize: 14 },
  statSub: { fontSize: 12, color: "rgba(255,255,255,0.85)", fontWeight: "600" },
  statDivider: { width: 1, height: 14, backgroundColor: "rgba(255,255,255,0.4)" },
  tabs: { flexDirection: "row", gap: 8, backgroundColor: colors.surfaceAlt, padding: 4, borderRadius: 14 },
  tab: {
    flex: 1,
    paddingVertical: 11,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
    borderRadius: 11,
  },
  tabActive: {
    backgroundColor: colors.text,
  },
  tabText: { fontWeight: "700", color: colors.textSecondary, fontSize: 13 },
  tabTextActive: { color: "#fff" },
  empty: { padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 19, fontWeight: "800", color: colors.text },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", textAlign: "center", marginTop: 6 },
});
