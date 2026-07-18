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
import { MapPin, Camera, X, Plus, ShieldAlert, ShieldCheck } from "lucide-react-native";
import { api, CATEGORIES } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors, brutal } from "../../src/theme";
import { startCheckout } from "../../src/billing";
import { MONETIZATION_ENABLED } from "../../src/features";

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
  const [boostPlan, setBoostPlan] = useState<null | "24h" | "48h">(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  const lookupAddress = async () => {
    // kept for compatibility; not used anymore — auto-geocoded on submit
    return;
  };

  const addPhoto = async (fromCamera: boolean = false) => {
    if (photos.length >= 4) return;
    const perm = fromCamera
      ? await ImagePicker.requestCameraPermissionsAsync()
      : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return;
    const opts: ImagePicker.ImagePickerOptions = {
      mediaTypes: ["images"],
      base64: true,
      quality: 0.5,
      allowsEditing: true,
    };
    const r = fromCamera
      ? await ImagePicker.launchCameraAsync(opts)
      : await ImagePicker.launchImageLibraryAsync(opts);
    if (!r.canceled && r.assets[0]?.base64) {
      setPhotos((p) => [...p, `data:image/jpeg;base64,${r.assets[0].base64}`]);
    }
  };

  const pickPhoto = () => {
    Alert.alert(
      "Add a photo",
      undefined,
      [
        { text: "Take photo", onPress: () => addPhoto(true) },
        { text: "Choose from library", onPress: () => addPhoto(false) },
        { text: "Cancel", style: "cancel" },
      ],
      { cancelable: true }
    );
  };

  const submit = async () => {
    if (!title.trim() || !description.trim() || !payAmount || !address.trim()) {
      setErr("Please fill all fields");
      return;
    }
    if (!coords) {
      // Auto-geocode the typed address silently before submitting
      try {
        const results = await Location.geocodeAsync(address.trim());
        if (results && results.length > 0) {
          setCoords({ lat: results[0].latitude, lng: results[0].longitude });
        } else {
          setErr("Could not find that address. Check spelling or use the GPS button.");
          return;
        }
      } catch {
        setErr("Could not look up that address. Check your connection or use GPS.");
        return;
      }
    }
    const finalCoords = coords || (await (async () => {
      const r = await Location.geocodeAsync(address.trim());
      return r[0] ? { lat: r[0].latitude, lng: r[0].longitude } : null;
    })());
    if (!finalCoords) {
      setErr("Address could not be resolved. Try GPS or a more complete address.");
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
      const job: any = await api("/jobs", {
        method: "POST",
        body: {
          title: title.trim(),
          description: description.trim(),
          category,
          pay_type: payType,
          pay_amount: amt,
          address: address.trim(),
          latitude: finalCoords.lat,
          longitude: finalCoords.lng,
          photos,
        },
      });
      // Apply boost if selected — opens real Stripe Checkout
      if (MONETIZATION_ENABLED && boostPlan) {
        try {
          const pkg = boostPlan === "24h" ? "boost_24h" : "boost_48h";
          const status = await startCheckout(pkg as any, { jobId: job.id });
          if (status?.payment_status !== "paid") {
            Alert.alert(
              "Job posted",
              "Your gig is live. Boost wasn't completed — you can boost it later from the job page."
            );
            // reset and bail early
            setTitle("");
            setDescription("");
            setPayAmount("");
            setAddress("");
            setPhotos([]);
            setBoostPlan(null);
            router.push(`/job/${job.id}`);
            return;
          }
        } catch (boostErr: any) {
          Alert.alert("Posted but boost failed", boostErr.message);
        }
      }
      Alert.alert(
        "Job posted!",
        boostPlan
          ? `Your gig is now live and boosted for ${boostPlan === "24h" ? "24" : "48"} hours.`
          : "Your gig is now live."
      );
      // reset
      setTitle("");
      setDescription("");
      setPayAmount("");
      setAddress("");
      setPhotos([]);
      setCoords(null);
      setBoostPlan(null);
      router.push(`/job/${job.id}`);
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
            onChangeText={(t) => {
              setAddress(t);
              if (coords) setCoords(null);
            }}
            placeholder="123 Main St, Springfield, IL"
            style={brutal.input}
            placeholderTextColor={colors.textDisabled}
            multiline
          />
          <Text style={styles.coordsHint}>
            Type the full street address above, OR tap the GPS button if you&apos;re at the job site.
          </Text>
          <TouchableOpacity
            testID="use-my-location"
            style={[styles.gpsBtn, coords && styles.gpsBtnSet]}
            onPress={useMyLocation}
            activeOpacity={0.85}
          >
            <MapPin size={18} color={coords ? "#fff" : colors.text} strokeWidth={2.4} />
            <Text style={[styles.gpsBtnText, coords && { color: "#fff" }]}>
              {coords ? "GPS Location Set ✓" : "Use My GPS Location"}
            </Text>
          </TouchableOpacity>

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
              <TouchableOpacity testID="add-photo" style={styles.photoAdd} onPress={pickPhoto}>
                <Plus size={20} color="#000" strokeWidth={2.5} />
              </TouchableOpacity>
            ) : null}
          </View>

          {err ? <Text style={styles.err} testID="post-error">{err}</Text> : null}

          {/* Boost options */}
          {MONETIZATION_ENABLED ? (
          <>
          <Text style={brutal.caption}>Boost this post (optional)</Text>
          <View style={styles.boostRow}>
            <BoostOption
              label="No boost"
              price="Free"
              active={boostPlan === null}
              onPress={() => setBoostPlan(null)}
              testID="boost-none"
            />
            <BoostOption
              label="24 hrs"
              price="$2"
              hot
              active={boostPlan === "24h"}
              onPress={() => setBoostPlan("24h")}
              testID="boost-24h"
            />
            <BoostOption
              label="48 hrs"
              price="$5"
              hot
              active={boostPlan === "48h"}
              onPress={() => setBoostPlan("48h")}
              testID="boost-48h"
            />
          </View>
          <Text style={styles.boostNote}>
            🚀 Boosted posts appear at the top of Browse with a glowing ribbon. You&apos;ll be charged at checkout.
          </Text>
          </>
          ) : null}

          <TouchableOpacity
            testID="post-submit"
            style={[brutal.buttonPrimary, loading && { opacity: 0.6 }]}
            onPress={submit}
            disabled={loading}
          >
            {loading ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={brutal.buttonText}>
                {MONETIZATION_ENABLED && boostPlan
                  ? `Post Job + Boost (${boostPlan === "24h" ? "$2" : "$5"})`
                  : "Post Job"}
              </Text>
            )}
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BoostOption({ label, price, active, hot, onPress, testID }: any) {
  return (
    <TouchableOpacity
      testID={testID}
      onPress={onPress}
      activeOpacity={0.88}
      style={[
        styles.boostOpt,
        active && (hot ? styles.boostOptHotActive : styles.boostOptActive),
      ]}
    >
      <Text style={[styles.boostOptLabel, active && styles.boostOptLabelActive]}>{label}</Text>
      <Text
        style={[
          styles.boostOptPrice,
          active && !hot && styles.boostOptPriceActive,
          active && hot && { color: colors.orange },
        ]}
      >
        {price}
      </Text>
    </TouchableOpacity>
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
  gateScroll: { paddingBottom: 40 },
  gateHero: { width: "100%", height: 220 },
  gateBox: { padding: 24, gap: 14, marginTop: -30, backgroundColor: colors.bg, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  gateIcon: {
    width: 64,
    height: 64,
    backgroundColor: colors.primarySoft,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  h1: { fontSize: 26, fontWeight: "800", color: colors.text, letterSpacing: -0.6 },
  muted: { color: colors.textSecondary, fontWeight: "500", lineHeight: 22 },
  boostRow: { flexDirection: "row", gap: 8 },
  boostOpt: {
    flex: 1,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: "center",
    backgroundColor: colors.surface,
    borderWidth: 1.5,
    borderColor: colors.border,
  },
  boostOptActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  boostOptHotActive: { borderColor: colors.orange, backgroundColor: "#FFE4D5" },
  boostOptLabel: { fontWeight: "700", fontSize: 13, color: colors.textSecondary },
  boostOptLabelActive: { color: colors.text },
  boostOptPrice: { fontWeight: "800", fontSize: 15, color: colors.text, marginTop: 2, letterSpacing: -0.3 },
  boostOptPriceActive: { color: colors.primary },
  boostNote: { fontSize: 12, color: colors.textSecondary, fontWeight: "500", lineHeight: 18 },

  coordsHint: {
    fontSize: 12,
    color: colors.textSecondary,
    fontWeight: "500",
    lineHeight: 17,
    marginTop: -4,
  },
  gpsBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: colors.primary,
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 14,
    marginTop: 4,
    minHeight: 56,
  },
  gpsBtnSet: {
    backgroundColor: "#10B981",
  },
  gpsBtnText: {
    color: "#fff",
    fontWeight: "900",
    fontSize: 16,
    letterSpacing: -0.3,
  },
});
