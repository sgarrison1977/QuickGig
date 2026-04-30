import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  Alert,
  Image,
  ActivityIndicator,
} from "react-native";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import * as Location from "expo-location";
import * as ImagePicker from "expo-image-picker";
import { MapPin, Camera, X, Plus, ShieldAlert } from "lucide-react-native";
import { api, CATEGORIES } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";

export default function PostJob() {
  const router = useRouter();
  const { user } = useAuth();

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("lawn");
  const [payType, setPayType] = useState<"hourly" | "fixed">("fixed");
  const [payAmount, setPayAmount] = useState("");
  const [address, setAddress] = useState("");
  const [coords, setCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  if (user && !user.is_verified) {
    return (
      <SafeAreaView style={styles.safe} edges={["top"]}>
        <View style={styles.gateBox}>
          <View style={styles.gateIcon}>
            <ShieldAlert size={36} color="#000" strokeWidth={2.5} />
          </View>
          <Text style={styles.h1}>Verify ID first</Text>
          <Text style={styles.muted}>You need to verify your identity before posting a job.</Text>
          <TouchableOpacity
            testID="goto-verify"
            style={brutal.buttonPrimary}
            onPress={() => router.push("/verify-id")}
          >
            <Text style={brutal.buttonText}>Verify Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const useMyLocation = async () => {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== "granted") {
      Alert.alert("Permission denied", "Please enable location to use this feature.");
      return;
    }
    const loc = await Location.getCurrentPositionAsync({});
    setCoords({ lat: loc.coords.latitude, lng: loc.coords.longitude });
    try {
      const r = await Location.reverseGeocodeAsync({ latitude: loc.coords.latitude, longitude: loc.coords.longitude });
      if (r[0]) {
        const a = r[0];
        const street = [a.streetNumber, a.street].filter(Boolean).join(" ");
        const city = [a.city, a.region, a.postalCode].filter(Boolean).join(", ");
        setAddress([street, city].filter(Boolean).join(", "));
      }
    } catch {}
  };

  const addPhoto = async () => {
    if (photos.length >= 4) return;
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      base64: true,
      quality: 0.5,
      allowsEditing: true,
    });
    if (!r.canceled && r.assets[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${r.assets[0].base64}`]);
    }
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !payAmount || !address.trim()) {
      setErr("Please fill all fields");
      return;
    }
    if (!coords) {
      setErr("Please set the job location (tap 'Use my location' or geocode the address)");
      return;
    }
    const amt = parseFloat(payAmount);
    if (isNaN(amt) || amt <= 0) {
      setErr("Pay amount must be a positive number");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const job = await api("/jobs", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          pay_type: payType,
          pay_amount: amt,
          address: address.trim(),
          latitude: coords.lat,
          longitude: coords.lng,
          photos,
        },
      });
      Alert.alert("Job posted!", "Your gig is now live.");
      // reset
      setTitle("");
      setDescription("");
      setPayAmount("");
      setAddress("");
      setPhotos([]);
      setCoords(null);
      router.replace(`/job/${job.id}`);
    } catch (e: any) {
      setErr(e.message || "Failed to post");
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
          <Text style={styles.tag}>POST A GIG</Text>
          <Text style={styles.title}>What do you need done?</Text>

          <Text style={brutal.caption}>Title</Text>
          <TextInput
            testID="post-title"
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Mow my lawn this weekend"
            style={brutal.input}
            placeholderTextColor={colors.textDisabled}
          />

          <Text style={brutal.caption}>Description</Text>
          <TextInput
            testID="post-description"
            value={description}
            onChangeText={setDescription}
            placeholder="Describe what needs to be done..."
            style={[brutal.input, { minHeight: 100, textAlignVertical: "top" }]}
            placeholderTextColor={colors.textDisabled}
            multiline
          />

          <Text style={brutal.caption}>Category</Text>
          <View style={styles.catGrid}>
            {CATEGORIES.map((c) => (
              <TouchableOpacity
                key={c.key}
                testID={`cat-${c.key}`}
                onPress={() => setCategory(c.key)}
                style={[
                  styles.catCard,
                  { backgroundColor: c.color },
                  category === c.key && styles.catCardActive,
                ]}
              >
                <Text style={styles.catEmoji}>{c.emoji}</Text>
                <Text style={styles.catLabel}>{c.label}</Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={brutal.caption}>Pay</Text>
          <View style={styles.payRow}>
            <TouchableOpacity
              testID="pay-fixed"
              style={[styles.payTypeBtn, payType === "fixed" && styles.payTypeBtnActive]}
              onPress={() => setPayType("fixed")}
            >
              <Text style={[styles.payTypeText, payType === "fixed" && { color: "#fff" }]}>Fixed</Text>
            </TouchableOpacity>
            <TouchableOpacity
              testID="pay-hourly"
              style={[styles.payTypeBtn, payType === "hourly" && styles.payTypeBtnActive]}
              onPress={() => setPayType("hourly")}
            >
              <Text style={[styles.payTypeText, payType === "hourly" && { color: "#fff" }]}>Hourly</Text>
            </TouchableOpacity>
          </View>
          <View style={styles.amountRow}>
            <Text style={styles.dollar}>$</Text>
            <TextInput
              testID="post-amount"
              value={payAmount}
              onChangeText={setPayAmount}
              placeholder="0"
              keyboardType="numeric"
              style={[brutal.input, { flex: 1 }]}
              placeholderTextColor={colors.textDisabled}
            />
            <Text style={styles.unit}>{payType === "hourly" ? "/hr" : "total"}</Text>
          </View>

          <Text style={brutal.caption}>Address</Text>
          <TextInput
            testID="post-address"
            value={address}
            onChangeText={setAddress}
            placeholder="Street, City"
            style={brutal.input}
            placeholderTextColor={colors.textDisabled}
          />
          <TouchableOpacity testID="use-my-location" style={brutal.buttonOutline} onPress={useMyLocation}>
            <MapPin size={18} color="#000" strokeWidth={2.5} />
            <Text style={brutal.buttonText}>{coords ? "Location set ✓" : "Use my current location"}</Text>
          </TouchableOpacity>
          {coords ? (
            <Text style={styles.coordsText}>
              {coords.lat.toFixed(4)}, {coords.lng.toFixed(4)}
            </Text>
          ) : null}

          <Text style={brutal.caption}>Photos (optional)</Text>
          <View style={styles.photoRow}>
            {photos.map((p, i) => (
              <View key={i} style={styles.photoItem}>
                <Image source={{ uri: p }} style={styles.photo} />
                <TouchableOpacity
                  style={styles.photoRm}
                  onPress={() => setPhotos((arr) => arr.filter((_, idx) => idx !== i))}
                >
                  <X size={14} color="#fff" strokeWidth={3} />
                </TouchableOpacity>
              </View>
            ))}
            {photos.length < 4 ? (
              <TouchableOpacity testID="add-photo" style={styles.photoAdd} onPress={addPhoto}>
                <Plus size={20} color="#000" strokeWidth={2.5} />
              </TouchableOpacity>
            ) : null}
          </View>

          {err ? <Text style={styles.err} testID="post-error">{err}</Text> : null}

          <TouchableOpacity
            testID="post-submit"
            style={[brutal.buttonPrimary, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#000" />
            ) : (
              <Text style={brutal.buttonText}>Post Job</Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  container: { padding: 20, gap: 12, paddingBottom: 60 },
  tag: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.textSecondary, marginTop: 4 },
  title: { fontSize: 30, fontWeight: "900", color: "#000", letterSpacing: -1.5, marginBottom: 8 },
  catGrid: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  catCard: {
    width: "31%",
    aspectRatio: 1,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    gap: 4,
    opacity: 0.6,
  },
  catCardActive: {
    opacity: 1,
    transform: [{ scale: 1.04 }],
  },
  catEmoji: { fontSize: 26 },
  catLabel: { fontSize: 11, fontWeight: "700", color: colors.text, textAlign: "center" },
  payRow: { flexDirection: "row", gap: 8, backgroundColor: colors.surfaceAlt, padding: 4, borderRadius: 14 },
  payTypeBtn: {
    flex: 1,
    borderRadius: 11,
    paddingVertical: 11,
    alignItems: "center",
  },
  payTypeBtnActive: { backgroundColor: colors.text },
  payTypeText: { fontWeight: "700", color: colors.textSecondary, fontSize: 13 },
  amountRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  dollar: { fontSize: 28, fontWeight: "800", color: colors.text },
  unit: { fontWeight: "700", color: colors.textSecondary, fontSize: 13 },
  coordsText: { fontSize: 11, color: colors.textSecondary, fontWeight: "600" },
  photoRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  photoItem: { width: 76, height: 76, position: "relative" },
  photo: { width: 76, height: 76, borderRadius: 12 },
  photoRm: {
    position: "absolute",
    top: -6,
    right: -6,
    width: 22,
    height: 22,
    backgroundColor: colors.error,
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  photoAdd: {
    width: 76,
    height: 76,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1.5,
    borderStyle: "dashed",
    borderColor: "rgba(0,0,0,0.18)",
    alignItems: "center",
    justifyContent: "center",
  },
  err: {
    color: colors.error,
    backgroundColor: "#FEE2E2",
    padding: 12,
    borderRadius: 12,
    fontWeight: "600",
    fontSize: 13,
  },
  gateBox: { flex: 1, alignItems: "center", justifyContent: "center", padding: 32, gap: 16 },
  gateIcon: {
    width: 80,
    height: 80,
    backgroundColor: colors.primarySoft,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 26, fontWeight: "800", color: colors.text },
  muted: { color: colors.textSecondary, fontWeight: "500", textAlign: "center" },
});
