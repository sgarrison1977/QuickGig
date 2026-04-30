import { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { MessageCircle, ShieldCheck } from "lucide-react-native";
import { api } from "../../src/api";
import { colors, shadows } from "../../src/theme";

export default function Messages() {
  const router = useRouter();
  const [convos, setConvos] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>("/conversations");
      setConvos(data);
    } catch {
      // silent
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  return (
    <SafeAreaView style={styles.safe} edges={["top"]}>
      <View style={styles.header}>
        <Text style={styles.tag}>YOUR CHATS</Text>
        <Text style={styles.title}>Inbox</Text>
      </View>

      {loading ? (
        <View style={styles.loading}>
          <ActivityIndicator size="large" color={colors.primary} />
        </View>
      ) : (
        <FlatList
          data={convos}
          keyExtractor={(c) => c.id}
          contentContainerStyle={styles.list}
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
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={32} color={colors.primary} strokeWidth={2.2} />
              </View>
              <Text style={styles.emptyTitle}>No conversations yet</Text>
              <Text style={styles.emptyDesc}>
                When you accept or have your job accepted, a chat will appear here.
              </Text>
            </View>
          }
          renderItem={({ item }) => (
            <TouchableOpacity
              testID={`convo-${item.id}`}
              style={styles.row}
              onPress={() => router.push(`/chat/${item.id}`)}
              activeOpacity={0.85}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.other_user?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name} numberOfLines={1}>{item.other_user?.name || "User"}</Text>
                  {item.other_user?.is_verified ? (
                    <ShieldCheck size={13} color={colors.verified} fill={colors.verified} strokeWidth={0} />
                  ) : null}
                </View>
                <Text style={styles.jobTitle} numberOfLines={1}>
                  Re: {item.job_title}
                </Text>
                <Text style={styles.lastMsg} numberOfLines={1}>
                  {item.last_message || "Say hi 👋"}
                </Text>
              </View>
            </TouchableOpacity>
          )}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg },
  header: { paddingHorizontal: 20, paddingTop: 8, paddingBottom: 4 },
  tag: { fontSize: 11, fontWeight: "800", letterSpacing: 1.6, color: colors.textSecondary },
  title: { fontSize: 32, fontWeight: "800", color: colors.text, letterSpacing: -1, marginTop: 2 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 12 },
  empty: { padding: 32, alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    backgroundColor: colors.primarySoft,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  emptyTitle: { fontSize: 20, fontWeight: "800", color: colors.text },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", textAlign: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 14,
    backgroundColor: colors.surface,
    borderRadius: 18,
    padding: 14,
    ...(shadows.soft as object),
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: colors.accentSoft,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "800", fontSize: 18, color: colors.accent },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 16, fontWeight: "700", color: colors.text },
  jobTitle: { fontSize: 12, fontWeight: "700", color: colors.primary, marginTop: 2 },
  lastMsg: { color: colors.textSecondary, marginTop: 4, fontSize: 14, fontWeight: "500" },
});
