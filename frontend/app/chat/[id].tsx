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
                  <Text style={[styles.bubbleText, m.sender_id === user?.id && { color: "#000" }]}>
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
          >
            <Send size={20} color="#000" strokeWidth={3} />
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
    paddingVertical: 10,
    gap: 12,
    borderBottomWidth: 2,
    borderBottomColor: "#000",
    backgroundColor: colors.alt,
  },
  back: {
    width: 40,
    height: 40,
    borderWidth: 2,
    borderColor: "#000",
    backgroundColor: "#fff",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontSize: 24, fontWeight: "900", color: "#000", letterSpacing: -1 },
  list: { padding: 16, gap: 8 },
  bubble: {
    maxWidth: "78%",
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 8,
  },
  mine: { alignSelf: "flex-end", backgroundColor: colors.yellow },
  theirs: { alignSelf: "flex-start", backgroundColor: "#fff" },
  bubbleText: { fontSize: 15, color: "#000", fontWeight: "500" },
  empty: { padding: 32, alignItems: "center" },
  emptyText: { color: colors.textSecondary, fontWeight: "600" },
  inputRow: {
    flexDirection: "row",
    gap: 8,
    padding: 12,
    borderTopWidth: 2,
    borderTopColor: "#000",
    backgroundColor: "#fff",
  },
  input: {
    flex: 1,
    borderWidth: 2,
    borderColor: "#000",
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "500",
    color: "#000",
    maxHeight: 100,
    backgroundColor: "#fff",
  },
  sendBtn: {
    width: 50,
    height: 50,
    backgroundColor: colors.primary,
    borderWidth: 2,
    borderColor: "#000",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOffset: { width: 3, height: 3 },
    shadowOpacity: 1,
    shadowRadius: 0,
    elevation: 4,
  },
});
