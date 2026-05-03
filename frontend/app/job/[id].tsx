import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  ActivityIndicator,
  Alert,
} from "react-native";
import { useRouter, useLocalSearchParams, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import {
  ArrowLeft,
  MapPin,
  ShieldCheck,
  Star,
  CheckCircle2,
  MessageCircle,
  XCircle,
  LogOut,
  UserX,
} from "lucide-react-native";
import { api, categoryMeta } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function JobDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const j = await api(`/jobs/${id}`);
      setJob(j);
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setLoading(false);
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const accept = async () => {
    setBusy(true);
    try {
      await api(`/jobs/${id}/accept`, { method: "POST" });
      Alert.alert("Accepted!", "Chat is now open with the poster.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const complete = async () => {
    setBusy(true);
    try {
      await api(`/jobs/${id}/complete`, { method: "POST" });
      Alert.alert("Job marked complete!", "Don't forget to leave a review.");
      load();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setBusy(false);
    }
  };

  const withdraw = async () => {
    Alert.alert(
      "Withdraw from job?",
      "The job will go back to open and the poster will be notified that you backed out. They may still leave a review.",
      [
        { text: "Keep working" },
        {
          text: "Withdraw",
          style: "destructive",
          onPress: async () => {
            setBusy(true);
            try {
              await api(`/jobs/${id}/withdraw`, { method: "POST" });
              Alert.alert(
                "Withdrew",
                "You're no longer on this job. Want to leave a review for the poster?",
                [
                  { text: "Not now", style: "cancel", onPress: () => router.back() },
                  {
                    text: "Leave review",
                    onPress: () => router.replace(`/review/${id}`),
                  },
                ]
              );
            } catch (e: any) {
              Alert.alert("Error", e.message);
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const cancel = async () => {
    Alert.alert("Cancel job?", "This cannot be undone.", [
      { text: "Keep" },
      {
        text: "Cancel job",
        style: "destructive",
        onPress: async () => {
          setBusy(true);
          try {
            await api(`/jobs/${id}/cancel`, { method: "POST" });
            router.back();
          } catch (e: any) {
            Alert.alert("Error", e.message);
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  const openChat = async () => {
    try {
      const convos = await api<any[]>("/conversations");
      const c = convos.find((x: any) => x.job_id === id);
      if (c) router.push(`/chat/${c.id}`);
      else Alert.alert("No conversation yet");
    } catch (e: any) {
      Alert.alert("Error", e.message);
    }
  };

  if (loading || !job) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  const cat = categoryMeta(job.category);
  const isPoster = user?.id === job.poster_id;
  const isWorker = user?.id === job.worker_id;
  const canAccept = job.status === "open" && !isPoster;
  // Only POSTER can mark complete
  const canComplete = job.status === "accepted" && isPoster;
  // Only WORKER can withdraw
  const canWithdraw = job.status === "accepted" && isWorker;
  // Completed-job review CTA (existing)
  const canReviewCompleted =
    job.status === "completed" && (isPoster || isWorker);
  // Abandoned-worker review CTA (poster reviews a worker who withdrew)
  const abandonments: any[] = Array.isArray(job.abandonments) ? job.abandonments : [];

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity
          testID="back-btn"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/browse"))}
          style={styles.back}
        >
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={[styles.catTag, { backgroundColor: cat.color }]}>
          <Text style={styles.catTagText}>
            {cat.emoji} {cat.label}
          </Text>
        </View>

        <Text style={styles.title}>{job.title}</Text>

        <StatusPill status={job.status} />

        {job.photos?.length ? (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.photosRow}>
            {job.photos.map((p: string, i: number) => (
              <Image key={i} source={{ uri: p }} style={styles.photo} />
            ))}
          </ScrollView>
        ) : null}

        <View style={[brutal.card, { backgroundColor: colors.yellow }]}>
          <Text style={brutal.caption}>Pay</Text>
          <Text style={styles.payText}>
            ${job.pay_amount}
            <Text style={styles.payUnit}>{job.pay_type === "hourly" ? "/hour" : " flat rate"}</Text>
          </Text>
          <Text style={styles.note}>* Payment is arranged directly between you and the other party.</Text>
        </View>

        <View style={brutal.card}>
          <Text style={brutal.caption}>Description</Text>
          <Text style={styles.desc}>{job.description}</Text>
        </View>

        <View style={brutal.card}>
          <Text style={brutal.caption}>Location</Text>
          <View style={styles.locRow}>
            <MapPin size={18} color="#000" strokeWidth={2.5} />
            <Text style={styles.address}>{job.address}</Text>
          </View>
          {job.distance_miles != null ? (
            <Text style={styles.distance}>≈ {job.distance_miles} miles from you</Text>
          ) : null}
        </View>

        {job.poster ? (
          <TouchableOpacity
            testID="poster-card"
            style={[brutal.card, styles.userRow]}
            onPress={() => router.push(`/profile/${job.poster.id}`)}
            activeOpacity={0.85}
          >
            <View style={styles.avatar}>
              <Text style={styles.avatarLetter}>{job.poster.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>{job.poster.name}</Text>
                {job.poster.is_verified ? (
                  <View style={styles.verBadge}>
                    <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.userMeta}>Posted by</Text>
              {job.poster.rating_count > 0 ? (
                <View style={styles.ratingRow}>
                  <Star size={14} color="#000" fill="#000" strokeWidth={2} />
                  <Text style={styles.ratingText}>
                    {job.poster.rating_avg.toFixed(1)} ({job.poster.rating_count})
                  </Text>
                </View>
              ) : null}
            </View>
          </TouchableOpacity>
        ) : null}

        {job.worker ? (
          <TouchableOpacity
            style={[brutal.card, styles.userRow, { backgroundColor: colors.secondarySoft }]}
            onPress={() => router.push(`/profile/${job.worker.id}`)}
            activeOpacity={0.85}
          >
            <View style={[styles.avatar, { backgroundColor: "#fff" }]}>
              <Text style={styles.avatarLetter}>{job.worker.name.charAt(0).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.userName}>{job.worker.name}</Text>
                {job.worker.is_verified ? (
                  <View style={styles.verBadge}>
                    <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <Text style={styles.userMeta}>Worker</Text>
            </View>
          </TouchableOpacity>
        ) : null}

        <View style={{ gap: 10, marginTop: 8 }}>
          {canAccept ? (
            <TouchableOpacity testID="accept-btn" style={brutal.buttonPrimary} onPress={accept} disabled={busy}>
              <CheckCircle2 size={18} color="#000" strokeWidth={3} />
              <Text style={brutal.buttonText}>{busy ? "Accepting..." : "Accept Job"}</Text>
            </TouchableOpacity>
          ) : null}
          {job.status === "open" && !isPoster && user && !user.is_verified ? null : null}

          {(isPoster || isWorker) && (job.status === "accepted" || job.status === "completed") ? (
            <TouchableOpacity testID="open-chat-btn" style={brutal.buttonSecondary} onPress={openChat}>
              <MessageCircle size={18} color="#000" strokeWidth={3} />
              <Text style={brutal.buttonText}>Open Chat</Text>
            </TouchableOpacity>
          ) : null}

          {canComplete ? (
            <TouchableOpacity testID="complete-btn" style={brutal.buttonOutline} onPress={complete} disabled={busy}>
              <CheckCircle2 size={18} color={colors.text} strokeWidth={2.4} />
              <Text style={brutal.buttonTextDark}>Mark Complete</Text>
            </TouchableOpacity>
          ) : null}

          {canWithdraw ? (
            <TouchableOpacity
              testID="withdraw-btn"
              style={styles.withdrawBtn}
              onPress={withdraw}
              disabled={busy}
              activeOpacity={0.85}
            >
              <LogOut size={18} color="#fff" strokeWidth={2.6} />
              <Text style={styles.withdrawText}>Withdraw from Job</Text>
            </TouchableOpacity>
          ) : null}

          {canReviewCompleted ? (
            <TouchableOpacity
              testID="review-btn"
              style={brutal.buttonPrimary}
              onPress={() => router.push(`/review/${job.id}`)}
            >
              <Star size={18} color="#fff" strokeWidth={2.4} />
              <Text style={brutal.buttonText}>Leave Review</Text>
            </TouchableOpacity>
          ) : null}

          {/* Poster can still review workers who abandoned, even if job is now re-open */}
          {isPoster && abandonments.length > 0 ? (
            <View style={styles.abandonBlock} testID="abandonment-list">
              <Text style={styles.abandonTitle}>
                {abandonments.length === 1
                  ? "A worker backed out of this job"
                  : `${abandonments.length} workers backed out of this job`}
              </Text>
              <Text style={styles.abandonSub}>
                Leave a review so other posters know.
              </Text>
              {abandonments.map((a, idx) => (
                <TouchableOpacity
                  key={`${a.worker_id}-${idx}`}
                  testID={`review-abandoned-${idx}`}
                  style={styles.abandonRow}
                  onPress={() =>
                    router.push(
                      `/review/${job.id}?revieweeId=${a.worker_id}&name=${encodeURIComponent(a.worker_name || "worker")}`
                    )
                  }
                  activeOpacity={0.85}
                >
                  <UserX size={16} color="#991B1B" strokeWidth={2.6} />
                  <Text style={styles.abandonRowText} numberOfLines={1}>
                    Review {a.worker_name || "worker"}
                  </Text>
                  <Star size={14} color="#991B1B" strokeWidth={2.6} />
                </TouchableOpacity>
              ))}
            </View>
          ) : null}

          {isPoster && job.status === "open" ? (
            <TouchableOpacity
              testID="cancel-job-btn"
              style={{
                backgroundColor: "#EF4444",
                borderRadius: 16,
                paddingVertical: 16,
                paddingHorizontal: 20,
                flexDirection: "row",
                alignItems: "center",
                justifyContent: "center",
              }}
              onPress={cancel}
              activeOpacity={0.85}
            >
              <XCircle size={18} color="#FFFFFF" strokeWidth={2.6} style={{ marginRight: 8 }} />
              <Text style={{ color: "#FFFFFF", fontWeight: "700", fontSize: 16 }}>
                Cancel Job
              </Text>
            </TouchableOpacity>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function StatusPill({ status }: { status: string }) {
  const map: any = {
    open: { color: colors.success, label: "OPEN" },
    accepted: { color: colors.warning, label: "IN PROGRESS" },
    completed: { color: colors.verified, label: "COMPLETED" },
    cancelled: { color: colors.error, label: "CANCELLED" },
  };
  const m = map[status] || { color: "#000", label: status.toUpperCase() };
  return (
    <View style={[styles.statusPill, { backgroundColor: m.color }]}>
      <Text style={styles.statusText}>{m.label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 12, paddingBottom: 40 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: colors.border,
  },
  catTag: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginTop: 8,
  },
  catTagText: { fontWeight: "700", fontSize: 11, color: colors.text },
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.8, lineHeight: 32 },
  statusPill: {
    alignSelf: "flex-start",
    borderRadius: 999,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  statusText: { fontWeight: "800", color: "#fff", fontSize: 10, letterSpacing: 0.8 },
  photosRow: { gap: 8, paddingVertical: 4 },
  photo: { width: 160, height: 110, borderRadius: 14, marginRight: 8 },
  payText: { fontSize: 36, fontWeight: "800", color: colors.text, letterSpacing: -0.8, marginTop: 4 },
  payUnit: { fontSize: 14, fontWeight: "600", color: colors.textSecondary },
  note: { fontSize: 11, color: colors.textSecondary, fontWeight: "500", marginTop: 4 },
  desc: { fontSize: 15, color: colors.text, lineHeight: 22, fontWeight: "500", marginTop: 6 },
  locRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 6 },
  address: { fontWeight: "600", color: colors.text, flex: 1 },
  distance: { fontSize: 12, fontWeight: "500", color: colors.textSecondary, marginTop: 4 },
  userRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarLetter: { fontSize: 20, fontWeight: "800", color: colors.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  userName: { fontSize: 16, fontWeight: "700", color: colors.text },
  userMeta: { color: colors.textSecondary, fontWeight: "500", fontSize: 12 },
  verBadge: {
    backgroundColor: colors.verified,
    borderRadius: 8,
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  ratingRow: { flexDirection: "row", alignItems: "center", gap: 4, marginTop: 2 },
  ratingText: { fontWeight: "700", color: colors.text },

  withdrawBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#B91C1C",
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 16,
  },
  withdrawText: { color: "#fff", fontWeight: "800", fontSize: 15.5, letterSpacing: -0.2 },

  abandonBlock: {
    backgroundColor: "#FEF2F2",
    borderWidth: 1,
    borderColor: "#FECACA",
    borderRadius: 16,
    padding: 14,
    gap: 8,
    marginTop: 4,
  },
  abandonTitle: { fontWeight: "800", color: "#991B1B", fontSize: 14, letterSpacing: -0.2 },
  abandonSub: { fontWeight: "500", color: "#991B1B", fontSize: 12 },
  abandonRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    backgroundColor: "#fff",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  abandonRowText: { flex: 1, fontWeight: "700", color: "#991B1B", fontSize: 13 },
});
