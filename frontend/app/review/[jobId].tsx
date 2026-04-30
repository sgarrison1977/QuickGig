import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  ScrollView,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Star } from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function Review() {
  const { jobId } = useLocalSearchParams<{ jobId: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [job, setJob] = useState<any>(null);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const j = await api(`/jobs/${jobId}`);
        setJob(j);
      } catch (e: any) {
        Alert.alert("Error", e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [jobId]);

  if (loading || !job || !user) return null;

  const revieweeId = user.id === job.poster_id ? job.worker_id : job.poster_id;
  const reviewee = user.id === job.poster_id ? job.worker : job.poster;

  if (!revieweeId) {
    return (
      <SafeAreaView style={styles.safe}>
        <Text style={{ padding: 20 }}>This job has no counterparty to review.</Text>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    setSubmitting(true);
    try {
      await api("/reviews", {
        method: "POST",
        body: { job_id: jobId, reviewee_id: revieweeId, rating, comment },
      });
      Alert.alert("Thanks!", "Your review has been posted.");
      router.back();
    } catch (e: any) {
      Alert.alert("Error", e.message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
        <ScrollView contentContainerStyle={styles.container}>
          <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.back}>
            <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
          </TouchableOpacity>

          <Text style={styles.title}>Rate {reviewee?.name || "user"}</Text>
          <Text style={styles.subtitle}>How was working with them on &quot;{job.title}&quot;?</Text>

          <View style={styles.starsRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <TouchableOpacity
                key={n}
                testID={`star-${n}`}
                onPress={() => setRating(n)}
                style={styles.starBtn}
              >
                <Star
                  size={44}
                  color="#000"
                  strokeWidth={2}
                  fill={n <= rating ? colors.yellow : "transparent"}
                />
              </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.ratingLabel}>{rating}.0 / 5</Text>

          <Text style={brutal.caption}>Comment (optional)</Text>
          <TextInput
            testID="review-comment"
            value={comment}
            onChangeText={setComment}
            placeholder="What stood out?"
            placeholderTextColor={colors.textDisabled}
            style={[brutal.input, { minHeight: 100, textAlignVertical: "top" }]}
            multiline
          />

          <TouchableOpacity
            testID="review-submit"
            style={[brutal.buttonPrimary, submitting && { opacity: 0.6 }]}
            onPress={submit}
            disabled={submitting}
          >
            <Text style={brutal.buttonText}>{submitting ? "Posting..." : "Submit Review"}</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 14 },
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
  title: { fontSize: 28, fontWeight: "800", color: colors.text, letterSpacing: -0.8, marginTop: 12 },
  subtitle: { color: colors.textSecondary, fontWeight: "500" },
  starsRow: { flexDirection: "row", justifyContent: "center", gap: 6, marginTop: 16 },
  starBtn: { padding: 4 },
  ratingLabel: { textAlign: "center", fontWeight: "800", fontSize: 18, color: colors.text },
});
