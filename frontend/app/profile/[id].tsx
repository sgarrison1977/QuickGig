import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, ShieldCheck, Star } from "lucide-react-native";
import { api } from "../../src/api";
import { colors, brutal } from "../../src/theme";

export default function PublicProfile() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const u = await api(`/users/${id}`, { auth: false });
        const r = await api(`/reviews/user/${id}`, { auth: false });
        setUser(u);
        setReviews(r);
      } catch {}
      setLoading(false);
    })();
  }, [id]);

  if (loading || !user) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator size="large" color="#000" style={{ marginTop: 60 }} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <ScrollView contentContainerStyle={styles.container}>
        <TouchableOpacity onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>

        <View style={[brutal.cardLarge, { backgroundColor: colors.accent }]}>
          <View style={styles.row}>
            {user.avatar ? (
              <Image source={{ uri: user.avatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatar, styles.avFallback]}>
                <Text style={styles.avLetter}>{user.name.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <View style={styles.nameRow}>
                <Text style={styles.name}>{user.name}</Text>
                {user.is_verified ? (
                  <View style={styles.ver}>
                    <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                  </View>
                ) : null}
              </View>
              <View style={styles.statsRow}>
                <View style={styles.stat}>
                  <Star size={14} color="#000" fill="#000" />
                  <Text style={styles.statText}>
                    {user.rating_count > 0 ? user.rating_avg.toFixed(1) : "—"}
                  </Text>
                </View>
                <Text style={styles.statSub}>{user.rating_count} reviews</Text>
                <Text style={styles.statSub}>•</Text>
                <Text style={styles.statSub}>{user.jobs_completed} done</Text>
              </View>
            </View>
          </View>
        </View>

        <Text style={styles.h2}>Reviews</Text>
        {reviews.length === 0 ? (
          <Text style={styles.muted}>No reviews yet.</Text>
        ) : (
          reviews.map((r) => (
            <View key={r.id} style={brutal.card}>
              <View style={styles.reviewHead}>
                <Text style={styles.reviewer}>{r.reviewer?.name || "User"}</Text>
                <View style={styles.starsSm}>
                  {[1, 2, 3, 4, 5].map((n) => (
                    <Star
                      key={n}
                      size={14}
                      color="#000"
                      fill={n <= r.rating ? colors.yellow : "transparent"}
                    />
                  ))}
                </View>
              </View>
              {r.comment ? <Text style={styles.comment}>{r.comment}</Text> : null}
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 14, paddingBottom: 40 },
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
  row: { flexDirection: "row", alignItems: "center", gap: 14 },
  avatar: { width: 70, height: 70, borderRadius: 35 },
  avFallback: { backgroundColor: "rgba(255,255,255,0.25)", alignItems: "center", justifyContent: "center" },
  avLetter: { fontSize: 30, fontWeight: "800", color: "#fff" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 22, fontWeight: "800", color: "#fff" },
  ver: {
    backgroundColor: "rgba(255,255,255,0.25)",
    borderRadius: 999,
    paddingHorizontal: 6,
    width: 22,
    height: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  statsRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 8, flexWrap: "wrap" },
  stat: { flexDirection: "row", alignItems: "center", gap: 4 },
  statText: { fontWeight: "800", color: "#fff" },
  statSub: { color: "rgba(255,255,255,0.85)", fontWeight: "600", fontSize: 13 },
  h2: { fontSize: 20, fontWeight: "800", color: colors.text, marginTop: 8 },
  muted: { color: colors.textSecondary, fontWeight: "500" },
  reviewHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  reviewer: { fontWeight: "700", color: colors.text },
  starsSm: { flexDirection: "row", gap: 2 },
  comment: { color: colors.text, marginTop: 6, fontWeight: "500" },
});
