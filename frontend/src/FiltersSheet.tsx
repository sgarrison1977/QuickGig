import React, { useEffect, useState } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Pressable,
  Switch,
  Platform,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { BlurView } from "expo-blur";
import { X, DollarSign, Clock, ShieldCheck, SortDesc, Zap, MapPin, Sparkles } from "lucide-react-native";
import { colors, shadows } from "./theme";

export type SortKey = "best" | "new" | "pay" | "near";
export type PayType = "all" | "hourly" | "fixed";

export type BrowseFilters = {
  pay_type: PayType;
  min_pay: number; // 0 means no min
  verified_only: boolean;
  sort: SortKey;
};

export const DEFAULT_FILTERS: BrowseFilters = {
  pay_type: "all",
  min_pay: 0,
  verified_only: false,
  sort: "best",
};

export function countActive(f: BrowseFilters): number {
  let n = 0;
  if (f.pay_type !== "all") n++;
  if (f.min_pay > 0) n++;
  if (f.verified_only) n++;
  if (f.sort !== "best") n++;
  return n;
}

const MIN_PAY_OPTIONS = [0, 15, 25, 50, 100];

const SORT_META: {
  key: SortKey;
  label: string;
  sub: string;
  Icon: any;
}[] = [
  { key: "best", label: "Best match", sub: "Boosted + closest first", Icon: Sparkles },
  { key: "near", label: "Closest", sub: "Nearest to your location", Icon: MapPin },
  { key: "new", label: "Newest", sub: "Just-posted jobs first", Icon: Clock },
  { key: "pay", label: "Highest pay", sub: "Biggest paychecks first", Icon: DollarSign },
];

type Props = {
  visible: boolean;
  value: BrowseFilters;
  hasLocation: boolean;
  onClose: () => void;
  onApply: (f: BrowseFilters) => void;
};

export function FiltersSheet({ visible, value, hasLocation, onClose, onApply }: Props) {
  const [draft, setDraft] = useState<BrowseFilters>(value);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (visible) setDraft(value);
  }, [visible, value]);

  const active = countActive(draft);
  const reset = () => setDraft(DEFAULT_FILTERS);
  const apply = () => {
    onApply(draft);
    onClose();
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent
      onRequestClose={onClose}
      statusBarTranslucent
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <BlurView intensity={Platform.OS === "ios" ? 30 : 15} tint="dark" style={StyleSheet.absoluteFill} />
      </Pressable>

      <View style={[styles.sheet, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        <View style={styles.handle} />

        <View style={styles.header}>
          <Text style={styles.title}>Filters {active ? `• ${active}` : ""}</Text>
          <TouchableOpacity onPress={onClose} testID="filters-close" style={styles.closeBtn} activeOpacity={0.7}>
            <X size={18} color={colors.text} strokeWidth={2.6} />
          </TouchableOpacity>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          showsVerticalScrollIndicator={false}
        >
          {/* Sort */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <SortDesc size={16} color={colors.text} strokeWidth={2.6} />
              <Text style={styles.sectionTitle}>Sort by</Text>
            </View>
            <View style={styles.sortGrid}>
              {SORT_META.map((s) => {
                const disabled = s.key === "near" && !hasLocation;
                const active = draft.sort === s.key;
                return (
                  <TouchableOpacity
                    key={s.key}
                    testID={`sort-${s.key}`}
                    style={[
                      styles.sortCard,
                      active && styles.sortCardActive,
                      disabled && { opacity: 0.4 },
                    ]}
                    onPress={() => !disabled && setDraft((d) => ({ ...d, sort: s.key }))}
                    activeOpacity={0.85}
                    disabled={disabled}
                  >
                    <s.Icon
                      size={16}
                      color={active ? "#fff" : colors.text}
                      strokeWidth={2.4}
                    />
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.sortLabel, active && { color: "#fff" }]}>
                        {s.label}
                        {disabled ? "  (GPS off)" : ""}
                      </Text>
                      <Text style={[styles.sortSub, active && { color: "rgba(255,255,255,0.8)" }]}>
                        {s.sub}
                      </Text>
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Pay type */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <Clock size={16} color={colors.text} strokeWidth={2.6} />
              <Text style={styles.sectionTitle}>Pay type</Text>
            </View>
            <View style={styles.pillRow}>
              {(["all", "hourly", "fixed"] as PayType[]).map((pt) => {
                const active = draft.pay_type === pt;
                return (
                  <TouchableOpacity
                    key={pt}
                    testID={`pay-type-${pt}`}
                    style={[styles.pill, active && styles.pillActive]}
                    activeOpacity={0.85}
                    onPress={() => setDraft((d) => ({ ...d, pay_type: pt }))}
                  >
                    <Text style={[styles.pillText, active && { color: "#fff" }]}>
                      {pt === "all" ? "All" : pt === "hourly" ? "Hourly" : "Fixed"}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Minimum pay */}
          <View style={styles.section}>
            <View style={styles.sectionHead}>
              <DollarSign size={16} color={colors.text} strokeWidth={2.6} />
              <Text style={styles.sectionTitle}>Minimum pay</Text>
            </View>
            <View style={styles.pillRow}>
              {MIN_PAY_OPTIONS.map((v) => {
                const active = draft.min_pay === v;
                return (
                  <TouchableOpacity
                    key={v}
                    testID={`min-pay-${v}`}
                    style={[styles.pill, active && styles.pillActive]}
                    activeOpacity={0.85}
                    onPress={() => setDraft((d) => ({ ...d, min_pay: v }))}
                  >
                    <Text style={[styles.pillText, active && { color: "#fff" }]}>
                      {v === 0 ? "Any" : `$${v}+`}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </View>

          {/* Verified only */}
          <View style={styles.section}>
            <View style={styles.switchRow}>
              <View style={[styles.verifiedIcon]}>
                <ShieldCheck size={18} color="#fff" strokeWidth={2.6} />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={styles.switchTitle}>Verified posters only</Text>
                <Text style={styles.switchSub}>Hide jobs from unverified posters</Text>
              </View>
              <Switch
                testID="verified-only-switch"
                value={draft.verified_only}
                onValueChange={(v) => setDraft((d) => ({ ...d, verified_only: v }))}
                trackColor={{ false: "#E5E5EA", true: colors.primary }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <TouchableOpacity
            testID="filters-reset"
            style={styles.resetBtn}
            onPress={reset}
            activeOpacity={0.85}
            disabled={active === 0}
          >
            <Text style={[styles.resetText, active === 0 && { opacity: 0.4 }]}>Reset</Text>
          </TouchableOpacity>
          <TouchableOpacity
            testID="filters-apply"
            style={styles.applyBtn}
            onPress={apply}
            activeOpacity={0.9}
          >
            <Zap size={16} color="#fff" strokeWidth={2.6} fill="#fff" />
            <Text style={styles.applyText}>Show results</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: "rgba(0,0,0,0.35)" },
  sheet: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#fff",
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxHeight: "86%",
    ...(shadows.lift as object),
  },
  handle: {
    width: 44,
    height: 5,
    borderRadius: 3,
    backgroundColor: "#E5E5EA",
    alignSelf: "center",
    marginTop: 10,
    marginBottom: 4,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 22,
    paddingVertical: 12,
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  body: { paddingHorizontal: 20, paddingBottom: 10 },
  section: { marginTop: 16 },
  sectionHead: { flexDirection: "row", alignItems: "center", gap: 7, marginBottom: 10 },
  sectionTitle: { fontSize: 14, fontWeight: "800", color: colors.text, letterSpacing: 0.1 },
  pillRow: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  pill: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 999,
    backgroundColor: colors.surfaceAlt,
  },
  pillActive: { backgroundColor: colors.text },
  pillText: { fontWeight: "700", fontSize: 13, color: colors.text },
  sortGrid: { gap: 8 },
  sortCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 13,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
  },
  sortCardActive: { backgroundColor: colors.primary },
  sortLabel: { fontWeight: "800", color: colors.text, fontSize: 14 },
  sortSub: { color: colors.textSecondary, fontSize: 11.5, fontWeight: "600", marginTop: 2 },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: colors.surfaceAlt,
    padding: 14,
    borderRadius: 16,
  },
  verifiedIcon: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: colors.verified || colors.secondary,
    alignItems: "center",
    justifyContent: "center",
  },
  switchTitle: { fontSize: 14, fontWeight: "800", color: colors.text },
  switchSub: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", marginTop: 2 },
  footer: {
    flexDirection: "row",
    gap: 10,
    paddingHorizontal: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#F0F0F0",
  },
  resetBtn: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  resetText: { fontWeight: "800", color: colors.text, fontSize: 14 },
  applyBtn: {
    flex: 2,
    paddingVertical: 14,
    borderRadius: 14,
    backgroundColor: colors.primary,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 7,
  },
  applyText: { fontWeight: "800", color: "#fff", fontSize: 15, letterSpacing: -0.2 },
});
