import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import {
  ArrowLeft,
  DollarSign,
  TrendingUp,
  RefreshCcw,
  ShoppingBag,
  Users,
} from "lucide-react-native";
import { api } from "../../src/api";
import { colors, shadows } from "../../src/theme";

type Totals = {
  amount: number;
  count: number;
};

type RevenueResp = {
  totals: {
    all_time: Totals;
    last_7_days: Totals;
    last_30_days: Totals;
    refunds_all_time: Totals;
    refunds_30_days: Totals;
    net_all_time: number;
  };
  by_package: { package_id: string; label: string; amount: number; count: number }[];
  daily_series_30d: { date: string; amount: number; count: number }[];
  top_customers: {
    user_id: string;
    name: string;
    email: string;
    amount: number;
    count: number;
  }[];
};

const fmt = (n: number) =>
  `$${(n || 0).toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function AdminRevenue() {
  const router = useRouter();
  const [data, setData] = useState<RevenueResp | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await api<RevenueResp>("/admin/revenue");
      setData(d);
    } catch {}
    setLoading(false);
    setRefreshing(false);
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const series = data?.daily_series_30d || [];
  const maxDaily = Math.max(1, ...series.map((s) => s.amount));

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back" style={styles.back} onPress={() => router.back()}>
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Revenue</Text>
      </View>

      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => {
              setRefreshing(true);
              load();
            }}
            tintColor={colors.primary}
          />
        }
      >
        {loading || !data ? (
          <View style={{ paddingVertical: 60 }}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Hero — net all-time */}
            <LinearGradient
              colors={[colors.primary, colors.yellow]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.heroCard}
            >
              <Text style={styles.heroLabel}>Net Revenue · All time</Text>
              <Text style={styles.heroAmount}>{fmt(data.totals.net_all_time)}</Text>
              <Text style={styles.heroSub}>
                {fmt(data.totals.all_time.amount)} gross · {fmt(data.totals.refunds_all_time.amount)} refunded
              </Text>
            </LinearGradient>

            {/* Range KPIs */}
            <View style={styles.kpiRow}>
              <Kpi
                label="7 days"
                amount={data.totals.last_7_days.amount}
                count={data.totals.last_7_days.count}
                icon={<TrendingUp size={16} color={colors.primary} strokeWidth={2.6} />}
              />
              <Kpi
                label="30 days"
                amount={data.totals.last_30_days.amount}
                count={data.totals.last_30_days.count}
                icon={<DollarSign size={16} color={colors.primary} strokeWidth={2.6} />}
              />
              <Kpi
                label="Refunds 30d"
                amount={data.totals.refunds_30_days.amount}
                count={data.totals.refunds_30_days.count}
                icon={<RefreshCcw size={16} color={colors.primary} strokeWidth={2.6} />}
              />
            </View>

            {/* Sparkline */}
            <View style={styles.card}>
              <Text style={styles.cardTitle}>Last 30 days</Text>
              <View style={styles.barWrap}>
                {series.map((s) => {
                  const h = Math.max(2, (s.amount / maxDaily) * 88);
                  return (
                    <View key={s.date} style={styles.barCol}>
                      <View
                        style={[
                          styles.bar,
                          {
                            height: h,
                            backgroundColor:
                              s.amount > 0 ? colors.primary : "#F3F3F3",
                          },
                        ]}
                      />
                    </View>
                  );
                })}
              </View>
              <View style={styles.barAxis}>
                <Text style={styles.axisText}>{series[0]?.date.slice(5)}</Text>
                <Text style={styles.axisText}>{series[series.length - 1]?.date.slice(5)}</Text>
              </View>
            </View>

            {/* By package */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <ShoppingBag size={16} color={colors.text} strokeWidth={2.6} />
                <Text style={styles.cardTitle}>Revenue by product</Text>
              </View>
              {data.by_package.length === 0 ? (
                <Text style={styles.muted}>No paid transactions yet.</Text>
              ) : (
                data.by_package.map((p) => (
                  <View key={p.package_id} style={styles.row}>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle}>{p.label}</Text>
                      <Text style={styles.rowSub}>
                        {p.count} {p.count === 1 ? "sale" : "sales"}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>{fmt(p.amount)}</Text>
                  </View>
                ))
              )}
            </View>

            {/* Top customers */}
            <View style={styles.card}>
              <View style={styles.cardHead}>
                <Users size={16} color={colors.text} strokeWidth={2.6} />
                <Text style={styles.cardTitle}>Top customers</Text>
              </View>
              {data.top_customers.length === 0 ? (
                <Text style={styles.muted}>No paid transactions yet.</Text>
              ) : (
                data.top_customers.map((c, i) => (
                  <View key={c.user_id} style={styles.row}>
                    <View style={styles.rank}>
                      <Text style={styles.rankText}>#{i + 1}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={styles.rowTitle} numberOfLines={1}>
                        {c.name}
                      </Text>
                      <Text style={styles.rowSub} numberOfLines={1}>
                        {c.email} · {c.count} {c.count === 1 ? "purchase" : "purchases"}
                      </Text>
                    </View>
                    <Text style={styles.rowAmount}>{fmt(c.amount)}</Text>
                  </View>
                ))
              )}
            </View>

            <Text style={styles.footnote}>
              Data is computed from QuickGig's payment_transactions ledger. For
              authoritative numbers (taxes, payouts, fees) see your{" "}
              <Text style={{ fontWeight: "800" }}>Stripe Dashboard</Text>.
            </Text>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function Kpi({
  label,
  amount,
  count,
  icon,
}: {
  label: string;
  amount: number;
  count: number;
  icon: any;
}) {
  return (
    <View style={styles.kpi}>
      <View style={styles.kpiIcon}>{icon}</View>
      <Text style={styles.kpiAmount}>{fmt(amount)}</Text>
      <Text style={styles.kpiLabel}>{label}</Text>
      <Text style={styles.kpiSub}>
        {count} {count === 1 ? "txn" : "txns"}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    gap: 12,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 22, fontWeight: "900", color: colors.text, letterSpacing: -0.6 },
  body: { padding: 16, gap: 14, paddingBottom: 40 },

  heroCard: {
    padding: 20,
    borderRadius: 24,
    gap: 4,
  },
  heroLabel: { fontSize: 12, fontWeight: "800", color: "rgba(255,255,255,0.85)", letterSpacing: 0.4 },
  heroAmount: { fontSize: 38, fontWeight: "900", color: "#fff", letterSpacing: -1.2, marginTop: 4 },
  heroSub: { fontSize: 12.5, fontWeight: "700", color: "rgba(255,255,255,0.85)", marginTop: 2 },

  kpiRow: { flexDirection: "row", gap: 10 },
  kpi: {
    flex: 1,
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    gap: 4,
    ...(shadows.soft as object),
  },
  kpiIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: "#FFF1F1",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  kpiAmount: { fontSize: 17, fontWeight: "900", color: colors.text, letterSpacing: -0.4 },
  kpiLabel: { fontSize: 11, fontWeight: "700", color: colors.text, marginTop: 2 },
  kpiSub: { fontSize: 10.5, color: colors.textSecondary, fontWeight: "600" },

  card: {
    padding: 14,
    borderRadius: 18,
    backgroundColor: "#fff",
    gap: 8,
    ...(shadows.soft as object),
  },
  cardHead: { flexDirection: "row", gap: 7, alignItems: "center", marginBottom: 4 },
  cardTitle: { fontSize: 15, fontWeight: "800", color: colors.text, letterSpacing: -0.2 },

  barWrap: {
    flexDirection: "row",
    alignItems: "flex-end",
    height: 100,
    gap: 2,
    paddingTop: 8,
  },
  barCol: { flex: 1, alignItems: "center", justifyContent: "flex-end" },
  bar: { width: "100%", borderRadius: 3 },
  barAxis: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 6,
  },
  axisText: { fontSize: 10, color: colors.textSecondary, fontWeight: "600" },

  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 8,
    borderTopWidth: 1,
    borderTopColor: "#F3F3F3",
  },
  rowTitle: { fontSize: 13.5, fontWeight: "800", color: colors.text },
  rowSub: { fontSize: 11.5, color: colors.textSecondary, fontWeight: "600", marginTop: 1 },
  rowAmount: { fontSize: 14, fontWeight: "900", color: colors.primary, letterSpacing: -0.2 },
  rank: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  rankText: { fontSize: 11, fontWeight: "900", color: colors.text },
  muted: { fontSize: 12, color: colors.textSecondary, fontWeight: "600", paddingVertical: 8 },
  footnote: {
    fontSize: 11,
    color: colors.textSecondary,
    textAlign: "center",
    marginTop: 4,
    fontWeight: "500",
  },
});
