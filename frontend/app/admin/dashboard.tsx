import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  TextInput,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  Users,
  MessageSquare,
  Briefcase,
  Ban,
  Check,
  Key,
  LogOut,
  ShieldCheck,
  Eye,
  Trash2,
  MapPin,
} from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

type Tab = "stats" | "users" | "chats" | "jobs" | "settings";

export default function AdminDashboard() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [tab, setTab] = useState<Tab>("stats");
  const [stats, setStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [convos, setConvos] = useState<any[]>([]);
  const [jobs, setJobs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [s, u, c, j] = await Promise.all([
        api("/admin/stats"),
        api("/admin/users"),
        api("/admin/conversations"),
        api("/admin/jobs"),
      ]);
      setStats(s);
      setUsers(u);
      setConvos(c);
      setJobs(j as any[]);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (user?.role !== "admin") {
        router.replace("/admin");
        return;
      }
      load();
    }, [user, router, load])
  );

  if (user?.role !== "admin") return null;

  const toggleBan = async (u: any) => {
    try {
      const path = u.banned ? "unban" : "ban";
      await api(`/admin/users/${u.id}/${path}`, { method: "POST" });
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  const permanentlyDeleteUser = (u: any) => {
    Alert.alert(
      "Permanently delete this user?",
      `${u.name} (${u.email}) will be anonymized to "Deleted User". Their personal info will be wiped, login disabled, and any open jobs will be cancelled. Past job/review records stay so other users keep their history. This cannot be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete forever",
          style: "destructive",
          onPress: () => {
            // Double-confirm — destructive irreversible action
            Alert.alert(
              "Are you absolutely sure?",
              `Tap "Yes, delete" to permanently anonymize ${u.name}.`,
              [
                { text: "Cancel", style: "cancel" },
                {
                  text: "Yes, delete",
                  style: "destructive",
                  onPress: async () => {
                    try {
                      await api(`/admin/users/${u.id}`, { method: "DELETE" });
                      load();
                      Alert.alert("Done", "Account anonymized.");
                    } catch (e: any) {
                      Alert.alert("Error", e.message);
                    }
                  },
                },
              ],
            );
          },
        },
      ],
    );
  };

  const deleteJob = (j: any) => {
    Alert.alert(
      "Delete this job?",
      `"${j.title}" will be permanently removed along with its chat history. This can't be undone.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              await api(`/admin/jobs/${j.id}`, { method: "DELETE" });
              load();
            } catch (e: any) {
              Alert.alert("Error", e.message);
            }
          },
        },
      ]
    );
  };


  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={styles.tag}>ADMIN PANEL</Text>
          <Text style={styles.title}>Control Center</Text>
        </View>
        <TouchableOpacity
          onPress={async () => {
            await signOut();
            router.replace("/(auth)/welcome");
          }}
          style={styles.logoutBtn}
          activeOpacity={0.85}
        >
          <LogOut size={18} color="#fff" strokeWidth={2.4} />
        </TouchableOpacity>
      </View>

      <View style={styles.tabs}>
        {(["stats", "users", "jobs", "chats", "settings"] as Tab[]).map((t) => (
          <TouchableOpacity
            key={t}
            testID={`admin-tab-${t}`}
            onPress={() => setTab(t)}
            style={[styles.tab, tab === t && styles.tabActive]}
            activeOpacity={0.85}
          >
            <Text style={[styles.tabText, tab === t && { color: "#fff" }]}>{t.toUpperCase()}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          {tab === "stats" && stats ? <StatsView stats={stats} /> : null}
          {tab === "users" ? (
            <View style={{ gap: 10 }}>
              {(() => {
                // Surface users with pending deletion requests at the top.
                const sorted = [...users].sort((a, b) => {
                  const da = a.deletion_requested ? 1 : 0;
                  const db = b.deletion_requested ? 1 : 0;
                  return db - da;
                });
                const pendingCount = sorted.filter((u) => u.deletion_requested).length;
                return (
                  <>
                    {pendingCount > 0 ? (
                      <View style={styles.deletionSummary} testID="deletion-summary">
                        <Trash2 size={14} color="#7F1D1D" strokeWidth={2.8} />
                        <Text style={styles.deletionSummaryText}>
                          {pendingCount} pending deletion {pendingCount === 1 ? "request" : "requests"}
                        </Text>
                      </View>
                    ) : null}
                    {sorted.map((u) => (
                      <View
                        key={u.id}
                        style={[
                          brutal.card,
                          u.banned && !u.deletion_requested && { backgroundColor: "#FEE2E2" },
                          u.deletion_requested && { backgroundColor: "#FFF7ED", borderColor: "#FDBA74" },
                          u.deleted && { backgroundColor: "#F3F4F6", opacity: 0.85 },
                        ]}
                        testID={`admin-user-${u.id}`}
                      >
                        <View style={styles.userRow}>
                          <View style={[styles.avatar, { backgroundColor: u.banned ? colors.error : colors.primary }]}>
                            <Text style={styles.avatarLetter}>{u.name?.charAt(0).toUpperCase() || "?"}</Text>
                          </View>
                          <View style={{ flex: 1 }}>
                            <View style={styles.nameRow}>
                              <Text style={styles.userName}>{u.name}</Text>
                              {u.is_verified ? (
                                <View style={styles.verBadge}>
                                  <ShieldCheck size={10} color="#fff" strokeWidth={3} />
                                </View>
                              ) : null}
                              {u.role === "admin" ? <Text style={styles.adminBadge}>ADMIN</Text> : null}
                              {u.deleted ? <Text style={styles.deletedBadge}>DELETED</Text> : null}
                              {u.deletion_requested ? (
                                <Text style={styles.delReqBadge} testID={`del-req-badge-${u.id}`}>
                                  DELETION REQUESTED
                                </Text>
                              ) : null}
                            </View>
                            <Text style={styles.userEmail}>{u.email}</Text>
                            <Text style={styles.muted}>
                              ⭐ {u.rating_avg?.toFixed(1) || "—"} · {u.jobs_completed} done
                            </Text>
                            {u.deletion_requested && u.deletion_reason ? (
                              <Text style={styles.delReasonText} numberOfLines={3}>
                                Reason: “{u.deletion_reason}”
                              </Text>
                            ) : null}
                            {u.deletion_requested && !u.deletion_reason ? (
                              <Text style={styles.delReasonText}>No reason provided.</Text>
                            ) : null}
                          </View>
                        </View>
                        {u.role !== "admin" && !u.deleted ? (
                          <View style={styles.userActions}>
                            <TouchableOpacity
                              testID={`ban-${u.id}`}
                              style={[styles.banBtn, u.banned && { backgroundColor: colors.success }]}
                              onPress={() => toggleBan(u)}
                            >
                              {u.banned ? (
                                <Check size={16} color="#fff" strokeWidth={3} />
                              ) : (
                                <Ban size={16} color="#fff" strokeWidth={3} />
                              )}
                              <Text style={styles.banText}>{u.banned ? "Unban" : "Ban"}</Text>
                            </TouchableOpacity>
                            {u.deletion_requested ? (
                              <TouchableOpacity
                                testID={`del-permanent-${u.id}`}
                                style={styles.deletePermBtn}
                                onPress={() => permanentlyDeleteUser(u)}
                              >
                                <Trash2 size={14} color="#fff" strokeWidth={3} />
                                <Text style={styles.banText}>Delete</Text>
                              </TouchableOpacity>
                            ) : null}
                          </View>
                        ) : null}
                      </View>
                    ))}
                  </>
                );
              })()}
            </View>
          ) : null}
          {tab === "chats" ? (
            <View style={{ gap: 10 }}>
              {convos.length === 0 ? (
                <Text style={styles.muted}>No conversations yet.</Text>
              ) : (
                convos.map((c) => (
                  <TouchableOpacity
                    key={c.id}
                    testID={`admin-convo-${c.id}`}
                    style={brutal.card}
                    onPress={() => router.push(`/chat/${c.id}`)}
                  >
                    <Text style={styles.convoTitle}>{c.job_title}</Text>
                    <Text style={styles.muted}>
                      {c.poster?.name} ↔ {c.worker?.name}
                    </Text>
                    <View style={[styles.viewRow]}>
                      <Eye size={14} color="#000" strokeWidth={2.5} />
                      <Text style={styles.viewText}>View Messages</Text>
                    </View>
                  </TouchableOpacity>
                ))
              )}
            </View>
          ) : null}
          {tab === "jobs" ? (
            <View style={{ gap: 10 }}>
              {jobs.length === 0 ? (
                <Text style={{ color: colors.textSecondary, padding: 20, textAlign: "center" }}>No jobs.</Text>
              ) : (
                jobs.map((j: any) => {
                  const statusColor =
                    j.status === "open" ? colors.primary :
                    j.status === "accepted" ? "#0EA5E9" :
                    j.status === "completed" ? "#10B981" :
                    j.status === "cancelled" ? "#991B1B" : colors.textSecondary;
                  return (
                    <View key={j.id} style={brutal.card}>
                      <View style={styles.userRow}>
                        <View style={[styles.avatar, { backgroundColor: statusColor }]}>
                          <Briefcase size={20} color="#fff" strokeWidth={2.6} />
                        </View>
                        <View style={{ flex: 1 }}>
                          <Text style={styles.userName} numberOfLines={1}>{j.title || "Untitled"}</Text>
                          <Text style={styles.userMeta} numberOfLines={1}>
                            {j.poster?.name || "Unknown"} · ${j.total_pay ?? j.hourly_rate ?? 0}{j.pay_type === "hourly" ? "/hr" : ""}
                          </Text>
                          <View style={{ flexDirection: "row", alignItems: "center", gap: 6, marginTop: 4, flexWrap: "wrap" }}>
                            <View style={{ backgroundColor: statusColor, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                              <Text style={{ color: "#fff", fontWeight: "800", fontSize: 10, letterSpacing: 0.5 }}>{(j.status || "").toUpperCase()}</Text>
                            </View>
                            {j.address ? (
                              <View style={{ flexDirection: "row", alignItems: "center", gap: 3 }}>
                                <MapPin size={11} color={colors.textSecondary} strokeWidth={2.4} />
                                <Text style={{ fontSize: 11, color: colors.textSecondary, fontWeight: "600" }} numberOfLines={1}>
                                  {j.address.slice(0, 32)}
                                </Text>
                              </View>
                            ) : null}
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: "row", gap: 8, marginTop: 10 }}>
                        <TouchableOpacity
                          style={[brutal.buttonOutline, { flex: 1 }]}
                          onPress={() => router.push(`/job/${j.id}`)}
                          activeOpacity={0.85}
                        >
                          <Eye size={16} color={colors.text} strokeWidth={2.4} />
                          <Text style={brutal.buttonTextDark}>View</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          testID={`delete-job-${j.id}`}
                          style={[brutal.buttonOutline, { flex: 1, borderColor: "#991B1B", backgroundColor: "#FEF2F2" }]}
                          onPress={() => deleteJob(j)}
                          activeOpacity={0.85}
                        >
                          <Trash2 size={16} color="#991B1B" strokeWidth={2.6} />
                          <Text style={[brutal.buttonTextDark, { color: "#991B1B" }]}>Delete</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  );
                })
              )}
            </View>
          ) : null}
          {tab === "settings" ? <SettingsView /> : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function StatsView({ stats }: { stats: any }) {
  const items = [
    { label: "Total Users", value: stats.users, icon: Users, color: colors.primarySoft },
    { label: "Verified", value: stats.verified_users, icon: ShieldCheck, color: colors.secondarySoft },
    { label: "Banned", value: stats.banned_users, icon: Ban, color: "#FEE2E2" },
    { label: "Total Jobs", value: stats.jobs_total, icon: Briefcase, color: colors.yellowSoft },
    { label: "Open Jobs", value: stats.jobs_open, icon: Briefcase, color: colors.accentSoft },
    { label: "Completed", value: stats.jobs_completed, icon: Check, color: "#D6F5EE" },
    { label: "Messages", value: stats.messages, icon: MessageSquare, color: "#FFE4D5" },
  ];
  return (
    <View style={{ gap: 14 }}>
      <View style={styles.statsGrid}>
        {items.map((it) => (
          <View key={it.label} style={[styles.statCard, { backgroundColor: it.color }]}>
            <it.icon size={20} color={colors.text} strokeWidth={2.2} />
            <Text style={styles.statValue}>{it.value}</Text>
            <Text style={styles.statLabel}>{it.label}</Text>
          </View>
        ))}
      </View>
      <RevenueLink />
    </View>
  );
}

function RevenueLink() {
  const router = useRouter();
  return (
    <TouchableOpacity
      testID="open-revenue"
      onPress={() => router.push("/admin/revenue")}
      activeOpacity={0.88}
      style={styles.revenueLink}
    >
      <View style={styles.revenueIcon}>
        <Text style={{ fontSize: 22 }}>💰</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={styles.revenueTitle}>Revenue analytics</Text>
        <Text style={styles.revenueSub}>Sales, refunds, top customers, last 30 days</Text>
      </View>
      <Text style={styles.revenueChev}>›</Text>
    </TouchableOpacity>
  );
}

function SettingsView() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);

  const change = async () => {
    if (next.length < 6) {
      Alert.alert("Error", "New password must be 6+ chars");
      return;
    }
    if (next !== confirm) {
      Alert.alert("Error", "Passwords don't match");
      return;
    }
    setBusy(true);
    try {
      await api("/admin/change-password", {
        method: "POST",
        body: { current_password: current, new_password: next },
      });
      Alert.alert("Done", "Password updated.");
      setCurrent("");
      setNext("");
      setConfirm("");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[brutal.card, { gap: 10 }]}>
        <View style={styles.settingsHead}>
          <Key size={20} color="#000" strokeWidth={2.5} />
          <Text style={styles.h3}>Change Admin Password</Text>
        </View>
        <Text style={brutal.caption}>Current Password</Text>
        <TextInput
          testID="current-password"
          value={current}
          onChangeText={setCurrent}
          secureTextEntry
          style={brutal.input}
        />
        <Text style={brutal.caption}>New Password</Text>
        <TextInput
          testID="new-password"
          value={next}
          onChangeText={setNext}
          secureTextEntry
          style={brutal.input}
        />
        <Text style={brutal.caption}>Confirm New Password</Text>
        <TextInput
          testID="confirm-password"
          value={confirm}
          onChangeText={setConfirm}
          secureTextEntry
          style={brutal.input}
        />
        <TouchableOpacity
          testID="change-pw-submit"
          style={[brutal.buttonPrimary, busy && { opacity: 0.6 }]}
          onPress={change}
          disabled={busy}
        >
          <Text style={brutal.buttonText}>{busy ? "Updating..." : "Update Password"}</Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 14,
    gap: 12,
    backgroundColor: colors.text,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tag: { fontSize: 10, fontWeight: "700", letterSpacing: 1.6, color: "rgba(255,255,255,0.6)" },
  title: { fontSize: 22, fontWeight: "800", color: "#fff", letterSpacing: -0.4 },
  logoutBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.1)",
    alignItems: "center",
    justifyContent: "center",
  },
  tabs: { flexDirection: "row", padding: 12, gap: 6, backgroundColor: colors.surface },
  tab: {
    flex: 1,
    paddingVertical: 10,
    backgroundColor: colors.surfaceAlt,
    borderRadius: 12,
    alignItems: "center",
  },
  tabActive: { backgroundColor: colors.primary },
  tabText: { fontWeight: "700", color: colors.textSecondary, fontSize: 11, letterSpacing: 0.4 },
  body: { padding: 16, gap: 12, paddingBottom: 40 },
  statsGrid: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  statCard: {
    width: "48%",
    borderRadius: 18,
    padding: 16,
    gap: 6,
  },
  statValue: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.5 },
  statLabel: { fontWeight: "700", color: colors.textSecondary, fontSize: 11, letterSpacing: 0.3 },
  revenueLink: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    borderWidth: 2,
    borderColor: colors.primary,
  },
  revenueIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  revenueTitle: { fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  revenueSub: { fontSize: 11.5, color: colors.textSecondary, fontWeight: "600", marginTop: 2 },
  revenueChev: { fontSize: 26, color: colors.primary, fontWeight: "900" },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 18, fontWeight: "800", color: "#fff" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6, flexWrap: "wrap" },
  userName: { fontSize: 15, fontWeight: "700", color: colors.text },
  userEmail: { color: colors.textSecondary, fontWeight: "500", fontSize: 12 },
  verBadge: {
    backgroundColor: colors.verified,
    borderRadius: 8,
    width: 16,
    height: 16,
    alignItems: "center",
    justifyContent: "center",
  },
  adminBadge: {
    backgroundColor: colors.text,
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    letterSpacing: 0.4,
    overflow: "hidden",
  },
  muted: { color: colors.textSecondary, fontWeight: "500", fontSize: 12, marginTop: 2 },
  banBtn: {
    backgroundColor: colors.error,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  banText: { color: "#fff", fontWeight: "700", fontSize: 11 },
  userActions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
    flexWrap: "wrap",
  },
  deletePermBtn: {
    backgroundColor: "#7F1D1D",
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 7,
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  deletedBadge: {
    backgroundColor: "#6B7280",
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    letterSpacing: 0.4,
    overflow: "hidden",
  },
  delReqBadge: {
    backgroundColor: "#B91C1C",
    color: "#fff",
    fontSize: 9,
    fontWeight: "800",
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 5,
    letterSpacing: 0.4,
    overflow: "hidden",
  },
  delReasonText: {
    fontSize: 12,
    color: "#7F1D1D",
    fontStyle: "italic",
    fontWeight: "500",
    marginTop: 4,
  },
  deletionSummary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#FEE2E2",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: "#B91C1C",
  },
  deletionSummaryText: {
    color: "#7F1D1D",
    fontWeight: "800",
    fontSize: 12.5,
    letterSpacing: -0.1,
  },
  convoTitle: { fontWeight: "700", fontSize: 15, color: colors.text },
  viewRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 6 },
  viewText: { fontWeight: "700", color: colors.primary, fontSize: 12 },
  settingsHead: { flexDirection: "row", alignItems: "center", gap: 8 },
  h3: { fontSize: 17, fontWeight: "800", color: colors.text },
});
