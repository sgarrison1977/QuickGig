import { useCallback, useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
} from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import { ArrowLeft, Send } from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<any[]>(`/conversations/${id}/messages`);
      setMessages(data);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  const send = async () => {
    if (!text.trim()) return;
    setSending(true);
    try {
      const m = await api(`/conversations/${id}/messages`, { method: "POST", body: { text: text.trim() } });
      setMessages((arr) => [...arr, m]);
      setText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch {}
    setSending(false);
  };

  return (
    <SafeAreaView style={styles.safe} edges={["top", "bottom"]}>
      <View style={styles.header}>
        <TouchableOpacity testID="back-btn" onPress={() => router.back()} style={styles.back}>
          <ArrowLeft size={22} color="#000" strokeWidth={2.5} />
        </TouchableOpacity>
        <Text style={styles.title}>Chat</Text>
      </View>

      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={{ flex: 1 }}
        keyboardVerticalOffset={Platform.OS === "ios" ? 60 : 0}
      >
        {loading ? (
          <ActivityIndicator size="large" color="#000" style={{ marginTop: 40 }} />
        ) : (
          <ScrollView
            ref={scrollRef}
            contentContainerStyle={styles.list}
            onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
          >
            {messages.length === 0 ? (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Say hi 👋 to get started</Text>
              </View>
            ) : (
              messages.map((m) => (
                <View
                  key={m.id}
                  testID={`msg-${m.id}`}
                  style={[styles.bubble, m.sender_id === user?.id ? styles.mine : styles.theirs]}
                >
                  <Text style={[styles.bubbleText, m.sender_id !== user?.id && { color: colors.text }]}>
                    {m.text}
                  </Text>
                </View>
              ))
            )}
          </ScrollView>
        )}

        <View style={styles.inputRow}>
          <TextInput
            testID="chat-input"
            value={text}
            onChangeText={setText}
            placeholder="Type a message..."
            placeholderTextColor={colors.textDisabled}
            style={styles.input}
            multiline
          />
          <TouchableOpacity
            testID="chat-send"
            onPress={send}
            disabled={!text.trim() || sending}
            style={[styles.sendBtn, (!text.trim() || sending) && { opacity: 0.5 }]}
            activeOpacity={0.85}
          >
            <Send size={18} color="#fff" strokeWidth={2.6} />
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
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
    backgroundColor: colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  back: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: colors.surfaceAlt,
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 20, fontWeight: "800", color: colors.text, letterSpacing: -0.4 },
  list: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: "78%",
    borderRadius: 18,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.primary, borderBottomRightRadius: 6 },
  theirs: { alignSelf: "flex-start", backgroundColor: colors.surface, borderBottomLeftRadius: 6 },
  bubbleText: { fontSize: 15, color: "#fff", fontWeight: "500" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontWeight: "500" },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderRadius: 22,
    backgroundColor: colors.surfaceAlt,
    paddingHorizontal: 16,
    paddingVertical: 11,
    fontSize: 15,
    fontWeight: "500",
    color: colors.text,
    maxHeight: 100,
  },
  sendBtn: {
    width: 44,
    height: 44,
    backgroundColor: colors.primary,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
});
