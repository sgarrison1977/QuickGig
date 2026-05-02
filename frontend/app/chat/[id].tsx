import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { ArrowLeft, Send, Lock, Clock } from "lucide-react-native";
import { api } from "../../src/api";
import { useAuth } from "../../src/auth";
import { colors } from "../../src/theme";

type ChatResponse = {
  messages: any[];
  chat_closes_at: string | null;
  chat_is_closed: boolean;
  chat_close_hours: number;
};

export default function Chat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { user } = useAuth();
  const [messages, setMessages] = useState<any[]>([]);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [closesAt, setClosesAt] = useState<string | null>(null);
  const [isClosed, setIsClosed] = useState(false);
  const [closeHours, setCloseHours] = useState(8);
  const [now, setNow] = useState(Date.now());
  const scrollRef = useRef<ScrollView>(null);

  const load = useCallback(async () => {
    try {
      const data = await api<ChatResponse>(`/conversations/${id}/messages`);
      // Defensive: accept both shapes (new object / old array) for forward compat
      if (Array.isArray(data)) {
        setMessages(data);
      } else {
        setMessages(data.messages || []);
        setClosesAt(data.chat_closes_at || null);
        setIsClosed(!!data.chat_is_closed);
        if (typeof data.chat_close_hours === "number") setCloseHours(data.chat_close_hours);
      }
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 50);
    } catch {}
    setLoading(false);
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5000);
    return () => clearInterval(t);
  }, [load]);

  // Tick every 30s to update the countdown & auto-lock when time runs out
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);

  // Client-side auto-close once closesAt passes (don't wait on the poll)
  const locallyClosed = useMemo(() => {
    if (isClosed) return true;
    if (!closesAt) return false;
    const ts = Date.parse(closesAt);
    return !isNaN(ts) && ts <= now;
  }, [isClosed, closesAt, now]);

  const countdown = useMemo(() => {
    if (!closesAt || locallyClosed) return null;
    const ts = Date.parse(closesAt);
    if (isNaN(ts)) return null;
    const diffMs = ts - now;
    if (diffMs <= 0) return null;
    const h = Math.floor(diffMs / 3600000);
    const m = Math.floor((diffMs % 3600000) / 60000);
    if (h >= 1) return `Chat closes in ${h}h ${m}m`;
    return `Chat closes in ${Math.max(m, 1)}m`;
  }, [closesAt, now, locallyClosed]);

  const send = async () => {
    if (!text.trim() || locallyClosed) return;
    setSending(true);
    try {
      const m = await api(`/conversations/${id}/messages`, {
        method: "POST",
        body: { text: text.trim() },
      });
      setMessages((arr) => [...arr, m]);
      setText("");
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 50);
    } catch (e: any) {
      // If backend says chat is closed, lock the UI immediately
      const msg = String(e?.message || "");
      if (msg.toLowerCase().includes("closed") || msg.includes("403")) {
        setIsClosed(true);
      }
    }
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

      {/* Countdown banner (only shown while chat is still open but job is completed) */}
      {countdown ? (
        <View style={styles.countdownBanner} testID="chat-countdown">
          <Clock size={14} color={colors.yellow} strokeWidth={2.6} />
          <Text style={styles.countdownText}>{countdown}</Text>
        </View>
      ) : null}

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
            {locallyClosed ? (
              <View style={styles.closedNotice} testID="chat-closed-notice">
                <Lock size={14} color={colors.textSecondary} strokeWidth={2.4} />
                <Text style={styles.closedNoticeText}>
                  Conversation ended — chat auto-closes {closeHours}h after a job is completed for
                  safety.
                </Text>
              </View>
            ) : null}
          </ScrollView>
        )}

        {locallyClosed ? (
          <View style={styles.closedBar} testID="chat-closed-bar">
            <Lock size={16} color="#fff" strokeWidth={2.8} />
            <Text style={styles.closedBarText}>Chat is closed for safety</Text>
          </View>
        ) : (
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
        )}
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
  countdownBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: 8,
    backgroundColor: "#FFF8E6",
    borderBottomWidth: 1,
    borderBottomColor: "#FFECB3",
  },
  countdownText: { fontSize: 12.5, fontWeight: "700", color: colors.text },
  closedNotice: {
    marginTop: 24,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 14,
    backgroundColor: colors.surface,
    alignSelf: "center",
    maxWidth: "92%",
  },
  closedNoticeText: {
    fontSize: 12.5,
    color: colors.textSecondary,
    fontWeight: "600",
    flex: 1,
    lineHeight: 17,
  },
  closedBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    padding: 16,
    backgroundColor: colors.text,
  },
  closedBarText: { color: "#fff", fontWeight: "800", fontSize: 14, letterSpacing: -0.2 },
});
