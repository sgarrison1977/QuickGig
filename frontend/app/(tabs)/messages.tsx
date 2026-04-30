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
import { colors, brutal } from "../../src/theme";

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
          <ActivityIndicator size="large" color="#000" />
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
            />
          }
          ListEmptyComponent={
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <MessageCircle size={36} color="#000" strokeWidth={2.5} />
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
              style={[brutal.card, styles.row]}
              onPress={() => router.push(`/chat/${item.id}`)}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {(item.other_user?.name || "?").charAt(0).toUpperCase()}
                </Text>
              </View>
              <View style={{ flex: 1 }}>
                <View style={styles.nameRow}>
                  <Text style={styles.name}>{item.other_user?.name || "User"}</Text>
                  {item.other_user?.is_verified ? (
                    <View style={styles.ver}>
                      <ShieldCheck size={11} color="#fff" strokeWidth={3} />
                    </View>
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
  tag: { fontSize: 12, fontWeight: "900", letterSpacing: 2, color: colors.textSecondary },
  title: { fontSize: 32, fontWeight: "900", color: "#000", letterSpacing: -1.5 },
  loading: { flex: 1, alignItems: "center", justifyContent: "center" },
  list: { padding: 20, gap: 12 },
  empty: { padding: 32, alignItems: "center", gap: 12 },
  emptyIcon: {
    width: 72,
    height: 72,
    backgroundColor: colors.secondary,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 4, height: 4 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 6,
  },
  emptyTitle: { fontSize: 22, fontWeight: "900", color: "#000" },
  emptyDesc: { color: colors.textSecondary, fontWeight: "500", textAlign: "center" },
  row: { flexDirection: "row", alignItems: "center", gap: 12 },
  avatar: {
    width: 48,
    height: 48,
    backgroundColor: colors.purple,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { fontWeight: "900", fontSize: 18, color: "#000" },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  name: { fontSize: 16, fontWeight: "900", color: "#000" },
  ver: {
    backgroundColor: colors.verified,
    borderWidth: 1.5,
    borderColor: "#000",
    width: 18,
    height: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  jobTitle: { fontSize: 12, fontWeight: "700", color: colors.primary, textTransform: "uppercase", marginTop: 2 },
  lastMsg: { color: colors.textSecondary, marginTop: 4, fontSize: 14, fontWeight: "500" },
});
