import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  RefreshControl,
  Switch,
  Modal,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ShieldCheck,
  Star,
  LogOut,
  ShieldAlert,
  Briefcase,
  CheckSquare,
  Crown,
  Bell,
  Hammer,
  CheckCircle2,
  XCircle,
  Pencil,
  Check,
  Trash2,
  AlertTriangle,
  X,
} from "lucide-react-native";
import { useAuth } from "../../src/auth";
import { api } from "../../src/api";
import { colors, brutal, shadows } from "../../src/theme";
import { MONETIZATION_ENABLED } from "../../src/features";
import { JobCard } from "./browse";
import { CollapsibleSection } from "../../src/CollapsibleSection";
import { getNotifSettings, setNotifEnabled, registerForPushNotifications } from "../../src/notifications";

type SectionKey = "posted" | "working" | "completed" | "cancelled";

export default function Profile() {
  const router = useRouter();
  const { user, signOut, refresh } = useAuth();
  const [posted, setPosted] = useState<any[]>([]);
  const [accepted, setAccepted] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [notifEnabled, setNotifEnabledState] = useState<boolean>(true);
  const [notifHasToken, setNotifHasToken] = useState<boolean>(false);
  // Account deletion request modal
  const [delModalOpen, setDelModalOpen] = useState(false);
  const [delReason, setDelReason] = useState("");
  const [delSubmitting, setDelSubmitting] = useState(false);
  // All sections start collapsed for minimal scrolling
  const [openSections, setOpenSections] = useState<Record<SectionKey, boolean>>({
    posted: false,
    working: false,
    completed: false,
    cancelled: false,
  });
  const toggleSection = (k: SectionKey) =>
    setOpenSections((s) => ({ ...s, [k]: !s[k] }));

  useEffect(() => {
    (async () => {
      const s = await getNotifSettings();
      setNotifEnabledState(!!s.enabled);
      setNotifHasToken(!!s.has_token);
    })();
  }, []);

  const onToggleNotif = async (v: boolean) => {
    setNotifEnabledState(v); // optimistic
    try {
      await setNotifEnabled(v);
      if (v) {
        const t = await registerForPushNotifications();
        setNotifHasToken(!!t);
      }
    } catch {
      setNotifEnabledState(!v); // revert on failure
    }
  };

  const submitDeletionRequest = async () => {
    setDelSubmitting(true);
    try {
      await api("/users/me/request-deletion", {
        method: "POST",
        body: { reason: delReason.trim() },
      });
      await refresh();
      setDelModalOpen(false);
      setDelReason("");
      Alert.alert(
        "Request received",
        "Your account deletion request has been submitted. An admin will review it soon. You can cancel anytime before it's processed.",
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message || "Could not submit request");
    } finally {
      setDelSubmitting(false);
    }
  };

  const cancelDeletionRequest = () => {
    Alert.alert(
      "Cancel deletion request?",
      "Your account will stay active and your data will not be removed.",
      [
        { text: "Keep request", style: "cancel" },
        {
          text: "Cancel request",
          style: "destructive",
          onPress: async () => {
            try {
              await api("/users/me/cancel-deletion", { method: "POST" });
              await refresh();
            } catch (e: any) {
              Alert.alert("Error", e?.message || "Could not cancel");
            }
          },
        },
      ],
    );
  };

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

  // Bucket jobs into the 4 sections.
  // - postedActive   = posted & status in (open, accepted)
  // - working        = accepted & status == accepted
  // - completed      = (posted OR accepted) & status == completed
  // - cancelled      = (posted OR accepted) & status == cancelled
  const buckets = useMemo(() => {
    const postedActive = posted.filter(
      (j) => j.status === "open" || j.status === "accepted"
    );
    const working = accepted.filter((j) => j.status === "accepted");
    const completedAll = [
      ...posted.filter((j) => j.status === "completed"),
      ...accepted.filter((j) => j.status === "completed"),
    ];
    const cancelledAll = [
      ...posted.filter((j) => j.status === "cancelled"),
      ...accepted.filter((j) => j.status === "cancelled"),
    ];
    // De-dupe (a job can technically appear in both posted+accepted lists if
    // user is somehow both poster and worker — defensive)
    const dedupe = (arr: any[]) => {
      const seen = new Set<string>();
      return arr.filter((j) => {
        if (seen.has(j.id)) return false;
        seen.add(j.id);
        return true;
      });
    };
    return {
      postedActive,
      working,
      completed: dedupe(completedAll),
      cancelled: dedupe(cancelledAll),
    };
  }, [posted, accepted]);

  if (!user) return null;

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
                {user.is_pro ? (
                  <View style={[styles.ver, { backgroundColor: "#FFD93C" }]}>
                    <Crown size={11} color={colors.text} strokeWidth={2.6} />
                    <Text style={[styles.verText, { color: colors.text }]}>PRO</Text>
                  </View>
                ) : null}
                {user.has_background_check ? (
                  <View style={[styles.ver, { backgroundColor: colors.secondary }]}>
                    <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                    <Text style={styles.verText}>BG✓</Text>
                  </View>
                ) : null}
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

        {!user.is_verified ? null : null}

        {/* Upgrade CTAs - always visible & prominent */}
        {MONETIZATION_ENABLED ? (
        <View style={styles.upgradeRow}>
          <TouchableOpacity
            testID="go-pro-cta"
            style={styles.upgradeCard}
            onPress={() => router.push("/upgrade?focus=pro")}
            activeOpacity={0.88}
          >
            <LinearGradient
              colors={user.is_pro ? ["#FFD93C", "#FF9F1C"] : ["#7C5CFF", "#FF5A5F"]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.upgradeInner}
            >
              <Crown size={22} color="#fff" strokeWidth={2.4} />
              <Text style={styles.upgradeTitle}>{user.is_pro ? "Pro Active" : "Go Pro"}</Text>
              <Text style={styles.upgradeSub}>{user.is_pro ? "Manage plan" : "$4.99/mo"}</Text>
            </LinearGradient>
          </TouchableOpacity>

          <TouchableOpacity
            testID="bg-check-cta"
            style={styles.upgradeCard}
            onPress={() => router.push("/upgrade?focus=bg")}
            activeOpacity={0.88}
          >
            <View style={[styles.upgradeInner, { backgroundColor: user.has_background_check ? colors.secondary : colors.text }]}>
              <ShieldCheck size={22} color="#fff" strokeWidth={2.4} />
              <Text style={styles.upgradeTitle}>
                {user.has_background_check ? "Bg Checked" : "Bg Check"}
              </Text>
              <Text style={styles.upgradeSub}>
                {user.has_background_check ? "Active" : "$10 once"}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
        ) : null}

        {/* Notifications toggle */}
        <View style={styles.notifRow} testID="notif-row">
          <View style={styles.notifIcon}>
            <Bell size={18} color={colors.primary} strokeWidth={2.6} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={styles.notifTitle}>Push notifications</Text>
            <Text style={styles.notifSub} numberOfLines={2}>
              {notifEnabled
                ? notifHasToken
                  ? "You'll be notified about messages & job updates"
                  : "Enable on your device to start receiving alerts"
                : "You won't be notified about new activity"}
            </Text>
          </View>
          <Switch
            testID="notif-toggle"
            value={notifEnabled}
            onValueChange={onToggleNotif}
            trackColor={{ false: "#E5E5EA", true: colors.primary }}
            thumbColor="#fff"
          />
        </View>

        {/* ============ JOB SECTIONS (collapsible) ============ */}
        <Text style={styles.sectionsHeading}>Your jobs</Text>

        <CollapsibleSection
          testID="section-posted"
          title="Posted"
          count={buckets.postedActive.length}
          open={openSections.posted}
          onToggle={() => toggleSection("posted")}
          icon={<Briefcase size={16} color={colors.primary} strokeWidth={2.6} />}
        >
          {buckets.postedActive.length === 0 ? (
            <SectionEmpty text="No active posted jobs. Tap Post to add one." />
          ) : (
            buckets.postedActive.map((j) => (
              <JobCard key={j.id} job={j} onPress={() => router.push(`/job/${j.id}`)} />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          testID="section-working"
          title="Working"
          count={buckets.working.length}
          open={openSections.working}
          onToggle={() => toggleSection("working")}
          icon={<Hammer size={16} color={colors.primary} strokeWidth={2.6} />}
        >
          {buckets.working.length === 0 ? (
            <SectionEmpty text="No jobs in progress. Accept one from Browse." />
          ) : (
            buckets.working.map((j) => (
              <JobCard key={j.id} job={j} onPress={() => router.push(`/job/${j.id}`)} />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          testID="section-completed"
          title="Completed"
          count={buckets.completed.length}
          open={openSections.completed}
          onToggle={() => toggleSection("completed")}
          tone="success"
          icon={<CheckCircle2 size={16} color="#065F46" strokeWidth={2.6} />}
        >
          {buckets.completed.length === 0 ? (
            <SectionEmpty text="No completed jobs yet." />
          ) : (
            buckets.completed.map((j) => (
              <CompletedJobItem
                key={j.id}
                job={j}
                currentUserId={user.id}
                onOpen={() => router.push(`/job/${j.id}`)}
                onReview={() => router.push(`/review/${j.id}`)}
              />
            ))
          )}
        </CollapsibleSection>

        <CollapsibleSection
          testID="section-cancelled"
          title="Cancelled"
          count={buckets.cancelled.length}
          open={openSections.cancelled}
          onToggle={() => toggleSection("cancelled")}
          tone="warning"
          icon={<XCircle size={16} color="#991B1B" strokeWidth={2.6} />}
        >
          {buckets.cancelled.length === 0 ? (
            <SectionEmpty text="No cancelled jobs." />
          ) : (
            buckets.cancelled.map((j) => (
              <JobCard key={j.id} job={j} onPress={() => router.push(`/job/${j.id}`)} />
            ))
          )}
        </CollapsibleSection>

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

        {/* Account deletion */}
        {user.deletion_requested ? (
          <View style={styles.deletionPending} testID="deletion-pending-banner">
            <View style={styles.deletionPendingHeader}>
              <AlertTriangle size={18} color="#92400E" strokeWidth={2.6} />
              <Text style={styles.deletionPendingTitle}>Deletion request pending</Text>
            </View>
            <Text style={styles.deletionPendingBody}>
              An admin will review your request soon. Your account is still active until they
              process it. You can cancel anytime before then.
            </Text>
            <TouchableOpacity
              testID="cancel-deletion-btn"
              style={styles.deletionCancelBtn}
              onPress={cancelDeletionRequest}
              activeOpacity={0.85}
            >
              <X size={16} color="#92400E" strokeWidth={2.8} />
              <Text style={styles.deletionCancelText}>Cancel deletion request</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity
            testID="request-deletion-btn"
            style={styles.deletionBtn}
            onPress={() => setDelModalOpen(true)}
            activeOpacity={0.85}
          >
            <Trash2 size={16} color="#B91C1C" strokeWidth={2.6} />
            <Text style={styles.deletionBtnText}>Request Account Deletion</Text>
          </TouchableOpacity>
        )}

        <View style={styles.legalRow}>
          <TouchableOpacity onPress={() => router.push("/eula")} testID="legal-eula">
            <Text style={styles.legalLink}>EULA</Text>
          </TouchableOpacity>
          <Text style={styles.legalDot}>·</Text>
          <TouchableOpacity onPress={() => router.push("/privacy")} testID="legal-privacy">
            <Text style={styles.legalLink}>Privacy Policy</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Deletion request modal */}
      <Modal
        visible={delModalOpen}
        transparent
        animationType="fade"
        onRequestClose={() => setDelModalOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={styles.modalBackdrop}
        >
          <View style={styles.modalCard} testID="deletion-modal">
            <View style={styles.modalHeader}>
              <View style={styles.modalIconWrap}>
                <Trash2 size={22} color="#B91C1C" strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>Request Account Deletion</Text>
                <Text style={styles.modalSub}>
                  An admin will review and process your request.
                </Text>
              </View>
              <TouchableOpacity
                onPress={() => setDelModalOpen(false)}
                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                testID="deletion-modal-close"
              >
                <X size={20} color={colors.textSecondary} strokeWidth={2.4} />
              </TouchableOpacity>
            </View>

            <View style={styles.modalNotice}>
              <Text style={styles.modalNoticeText}>
                When approved, your name and email will be replaced with “Deleted User”
                and all your personal info will be wiped. Past job and review records will
                stay so other users keep their history. This cannot be undone.
              </Text>
            </View>

            <Text style={styles.modalLabel}>Reason (optional)</Text>
            <TextInput
              testID="deletion-reason-input"
              style={styles.modalInput}
              placeholder="Help us improve — why are you leaving?"
              placeholderTextColor={colors.textSecondary}
              value={delReason}
              onChangeText={setDelReason}
              multiline
              maxLength={1000}
              textAlignVertical="top"
            />

            <View style={styles.modalActions}>
              <TouchableOpacity
                style={[brutal.buttonOutline, { flex: 1 }]}
                onPress={() => setDelModalOpen(false)}
                disabled={delSubmitting}
                activeOpacity={0.85}
              >
                <Text style={brutal.buttonTextDark}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                testID="deletion-submit-btn"
                style={[styles.modalSubmit, delSubmitting && { opacity: 0.6 }]}
                onPress={submitDeletionRequest}
                disabled={delSubmitting}
                activeOpacity={0.85}
              >
                <Trash2 size={16} color="#fff" strokeWidth={2.8} />
                <Text style={styles.modalSubmitText}>
                  {delSubmitting ? "Submitting…" : "Submit request"}
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

function SectionEmpty({ text }: { text: string }) {
  return (
    <View style={styles.sectionEmpty}>
      <Text style={styles.sectionEmptyText}>{text}</Text>
    </View>
  );
}

/**
 * Completed-job row: shows the regular JobCard plus a "Reviewed ✓" badge or
 * a "Leave Review" CTA so the user can confirm completion via review.
 */
function CompletedJobItem({
  job,
  currentUserId,
  onOpen,
  onReview,
}: {
  job: any;
  currentUserId: string;
  onOpen: () => void;
  onReview: () => void;
}) {
  const reviewed = !!job.my_review_id;
  // Identify who the OTHER party is (the reviewee from this user's POV)
  const otherName =
    job.poster_id === currentUserId
      ? job.worker?.name ?? "the worker"
      : job.poster?.name ?? "the poster";
  return (
    <View style={{ gap: 8 }}>
      <JobCard job={job} onPress={onOpen} />
      {reviewed ? (
        <View style={styles.reviewedPill} testID="review-status-done">
          <Check size={14} color="#065F46" strokeWidth={3} />
          <Text style={styles.reviewedPillText}>You reviewed {otherName}</Text>
        </View>
      ) : (
        <TouchableOpacity
          testID="leave-review-btn"
          style={styles.reviewCta}
          onPress={onReview}
          activeOpacity={0.85}
        >
          <Pencil size={14} color="#fff" strokeWidth={2.6} />
          <Text style={styles.reviewCtaText}>Leave a review for {otherName}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
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
  upgradeRow: { flexDirection: "row", gap: 10 },
  upgradeCard: { flex: 1, borderRadius: 18, overflow: "hidden" },
  upgradeInner: { padding: 16, gap: 4, minHeight: 96, justifyContent: "center" },
  upgradeTitle: { fontSize: 16, fontWeight: "800", color: "#fff", letterSpacing: -0.3, marginTop: 4 },
  upgradeSub: { fontSize: 12, fontWeight: "600", color: "rgba(255,255,255,0.85)" },
  notifRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#fff",
    borderRadius: 16,
    padding: 14,
    ...(shadows.soft as object),
  },
  notifIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
  },
  notifTitle: { fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },
  notifSub: { fontSize: 12, color: colors.textSecondary, marginTop: 2, fontWeight: "500" },

  sectionsHeading: {
    fontSize: 12,
    fontWeight: "900",
    color: colors.textSecondary,
    letterSpacing: 1.4,
    marginTop: 4,
    marginBottom: -4,
    paddingHorizontal: 4,
  },
  sectionEmpty: {
    paddingVertical: 14,
    paddingHorizontal: 6,
    alignItems: "center",
  },
  sectionEmptyText: {
    fontSize: 12.5,
    fontWeight: "600",
    color: colors.textSecondary,
    textAlign: "center",
  },

  reviewedPill: {
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    backgroundColor: "#D1FAE5",
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  reviewedPillText: {
    color: "#065F46",
    fontWeight: "800",
    fontSize: 12,
    letterSpacing: -0.1,
  },
  reviewCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: colors.primary,
    paddingVertical: 11,
    borderRadius: 12,
  },
  reviewCtaText: { color: "#fff", fontWeight: "800", fontSize: 13.5, letterSpacing: -0.2 },
  legalRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    marginTop: 8,
  },
  legalLink: {
    fontSize: 12,
    fontWeight: "700",
    color: colors.textSecondary,
    textDecorationLine: "underline",
  },
  legalDot: {
    fontSize: 12,
    color: colors.textSecondary,
  },

  // Account deletion
  deletionBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    backgroundColor: "#FEF2F2",
    borderWidth: 1.5,
    borderColor: "#FCA5A5",
    borderRadius: 14,
    marginTop: 8,
  },
  deletionBtnText: {
    color: "#B91C1C",
    fontWeight: "800",
    fontSize: 13.5,
    letterSpacing: -0.1,
  },
  deletionPending: {
    backgroundColor: "#FEF3C7",
    borderRadius: 14,
    borderWidth: 1.5,
    borderColor: "#FCD34D",
    padding: 14,
    gap: 8,
    marginTop: 8,
  },
  deletionPendingHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  deletionPendingTitle: {
    fontSize: 14,
    fontWeight: "800",
    color: "#92400E",
    letterSpacing: -0.2,
  },
  deletionPendingBody: {
    fontSize: 12.5,
    color: "#78350F",
    fontWeight: "500",
    lineHeight: 18,
  },
  deletionCancelBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 10,
    backgroundColor: "rgba(255,255,255,0.7)",
    borderRadius: 10,
    marginTop: 4,
  },
  deletionCancelText: {
    color: "#92400E",
    fontWeight: "800",
    fontSize: 12.5,
  },

  // Deletion modal
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  modalCard: {
    backgroundColor: "#fff",
    borderRadius: 22,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 12,
  },
  modalIconWrap: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FEE2E2",
    alignItems: "center",
    justifyContent: "center",
  },
  modalTitle: {
    fontSize: 17,
    fontWeight: "800",
    color: colors.text,
    letterSpacing: -0.3,
  },
  modalSub: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: "500",
    marginTop: 2,
  },
  modalNotice: {
    backgroundColor: "#FEF2F2",
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: "#FECACA",
  },
  modalNoticeText: {
    fontSize: 12.5,
    color: "#7F1D1D",
    fontWeight: "500",
    lineHeight: 18,
  },
  modalLabel: {
    fontSize: 12,
    fontWeight: "800",
    color: colors.textSecondary,
    letterSpacing: 0.6,
    marginTop: 4,
  },
  modalInput: {
    minHeight: 90,
    backgroundColor: colors.surface,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: colors.border,
    padding: 12,
    fontSize: 14,
    color: colors.text,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 4,
  },
  modalSubmit: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#B91C1C",
    paddingVertical: 14,
    borderRadius: 12,
  },
  modalSubmitText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 14,
    letterSpacing: -0.1,
  },
});
