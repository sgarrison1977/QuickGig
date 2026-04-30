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
import { ShieldCheck, Star, LogOut, ShieldAlert, Briefcase, CheckSquare } from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { colors, brutal } from "../../src/theme";
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
        <View style={[brutal.cardLarge, { backgroundColor: colors.alt }]}>
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
                <Text style={styles.name}>{user.name}</Text>
                {user.is_verified ? (
                  <View style={styles.ver}>
                    <ShieldCheck size={12} color="#fff" strokeWidth={3} />
                    <Text style={styles.verText}>VERIFIED</Text>
                  </View>
                ) : (
                  <View style={[styles.ver, { backgroundColor: colors.error }]}>
                    <ShieldAlert size={12} color="#fff" strokeWidth={3} />
                    <Text style={styles.verText}>UNVERIFIED</Text>
                  </View>
                )}
              </View>
              <Text style={styles.email}>{user.email}</Text>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Star size={14} color="#000" fill="#000" strokeWidth={2} />
                  <Text style={styles.statText}>
                    {user.rating_count > 0 ? user.rating_avg.toFixed(1) : "—"}
                  </Text>
                  <Text style={styles.statSub}>({user.rating_count})</Text>
                </View>
                <View style={styles.stat}>
                  <CheckSquare size={14} color="#000" strokeWidth={2.5} />
                  <Text style={styles.statText}>{user.jobs_completed}</Text>
                  <Text style={styles.statSub}>done</Text>
                </View>
              </View>
            </View>
          </View>
        </View>

        {!user.is_verified ? (
          <TouchableOpacity
            testID="verify-cta"
            style={[brutal.buttonPrimary]}
            onPress={() => router.push("/verify-id")}
          >
            <ShieldCheck size={18} color="#000" strokeWidth={3} />
            <Text style={brutal.buttonText}>Verify Your ID</Text>
          </TouchableOpacity>
        ) : null}

        <View style={styles.tabs}>
          <TouchableOpacity
            testID="tab-posted"
            style={[styles.tab, tab === "posted" && styles.tabActive]}
            onPress={() => setTab("posted")}
          >
            <Briefcase size={16} color="#000" strokeWidth={2.5} />
            <Text style={styles.tabText}>Posted ({posted.length})</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="tab-accepted"
            style={[styles.tab, tab === "accepted" && styles.tabActive]}
            onPress={() => setTab("accepted")}
          >
            <CheckSquare size={16} color="#000" strokeWidth={2.5} />
            <Text style={styles.tabText}>Working ({accepted.length})</Text>
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
        >
          <LogOut size={18} color="#000" strokeWidth={2.5} />
          <Text style={brutal.buttonText}>Sign Out</Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 16, paddingBottom: 40 },
  profileRow: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 70, height: 70, borderWidth: 2, borderColor: "#000" },
  avatarFallback: {
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 32, fontWeight: "900", color: "#000" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" },
  name: { fontSize: 22, fontWeight: "900", color: "#000" },
  ver: {
    flexDirection: "row",
    alignItems: "center",
    gap: 3,
    backgroundColor: colors.verified,
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  verText: { color: "#fff", fontWeight: "900", fontSize: 9, letterSpacing: 0.5 },
  email: { color: colors.textSecondary, fontWeight: "600", marginTop: 2 },
  statsRow: { flexDirection: "row", gap: 12, marginTop: 8 },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontWeight: "900", color: "#000", fontSize: 14 },
  statSub: { fontSize: 12, color: colors.textSecondary, fontWeight: "700" },
  tabs: { flexDirection: "row", gap: 8 },
  tab: {
    flex: 1,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: "#000",
    paddingVertical: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.yellow,
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
  tabText: { fontWeight: "900", color: "#000", fontSize: 13, textTransform: "uppercase" },
  empty: { padding: 24, alignItems: "center" },
  emptyTitle: { fontSize: 20, fontWeight: "900", color: "#000" },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", textAlign: "center", marginTop: 6 },
});
