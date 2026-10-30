import { useEffect, useRef, useState } from "react";
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, type ScrollViewInstance, StyleSheet, Text, TextInput, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api-client";
import { errorMessage, useApi } from "../../lib/use-api";
import { CoachMessage } from "../../lib/types";
import { Button, Empty, ErrorBlock, Loading, Muted } from "../../components/ui";

interface ConversationResponse {
  provider: "openai" | "local";
  conversationId: string | null;
  messages: CoachMessage[];
}

interface SendResponse {
  conversationId: string;
  provider: "openai" | "local";
  message: CoachMessage;
}

const SUGGESTIONS = ["What's today's WOD?", "What are my PRs?", "How is my progress?", "What classes am I booked into?"];

export default function CoachScreen() {
  const { user } = useAuth();
  const conversation = useApi<ConversationResponse>(user?.role === "MEMBER" ? "/ai-coach/conversation" : null);
  const [messages, setMessages] = useState<CoachMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [provider, setProvider] = useState<"openai" | "local" | null>(null);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scroller = useRef<ScrollViewInstance>(null);

  useEffect(() => {
    if (conversation.data) {
      setMessages(conversation.data.messages);
      setConversationId(conversation.data.conversationId ?? undefined);
      setProvider(conversation.data.provider);
    }
  }, [conversation.data]);

  useEffect(() => {
    scroller.current?.scrollToEnd({ animated: true });
  }, [messages.length, sending]);

  if (user && user.role !== "MEMBER") {
    return (
      <View style={styles.screen}>
        <Empty title="Member feature" message="The assistant coach answers members' questions about their own training." />
      </View>
    );
  }
  if (conversation.loading && !conversation.data) return <Loading label="Loading your chat..." />;

  async function send(message: string) {
    const content = message.trim();
    if (!content || sending) return;
    setError(null);
    setSending(true);
    setText("");
    const optimistic: CoachMessage = { id: `local-${Date.now()}`, role: "USER", content, createdAt: new Date().toISOString() };
    setMessages((m) => [...m, optimistic]);
    try {
      const res = await apiClient.post<SendResponse>("/ai-coach/messages", { message: content, conversationId });
      setConversationId(res.conversationId);
      setProvider(res.provider);
      setMessages((m) => [...m, res.message]);
    } catch (e) {
      setMessages((m) => m.filter((x) => x.id !== optimistic.id));
      setText(content);
      setError(errorMessage(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined} keyboardVerticalOffset={90}>
      {provider === "local" && (
        <View style={styles.banner} accessibilityLabel="Basic mode notice">
          <Muted>Basic mode: no AI model is connected, so answers come straight from your own gym data.</Muted>
        </View>
      )}
      <ScrollView ref={scroller} style={{ flex: 1 }} contentContainerStyle={styles.messages} keyboardShouldPersistTaps="handled">
        {conversation.error && <ErrorBlock message={conversation.error} onRetry={conversation.reload} />}
        {messages.length === 0 && !conversation.error && (
          <View style={{ gap: spacing.xs }}>
            <Text style={styles.intro}>Ask about today's WOD, your PRs, your progress or your classes.</Text>
            <Muted>I can only talk about your own training data. For pain or injuries, please speak to a coach or doctor.</Muted>
            <View style={styles.chips}>
              {SUGGESTIONS.map((s) => (
                <Pressable key={s} style={styles.chip} onPress={() => send(s)} accessibilityRole="button" accessibilityLabel={s}>
                  <Text style={styles.chipText}>{s}</Text>
                </Pressable>
              ))}
            </View>
          </View>
        )}
        {messages.map((m) => (
          <View key={m.id} style={[styles.bubble, m.role === "USER" ? styles.user : styles.assistant]}>
            <Text style={styles.bubbleText}>{m.content}</Text>
          </View>
        ))}
        {sending && (
          <View style={[styles.bubble, styles.assistant]}>
            <Text style={styles.muted}>Thinking...</Text>
          </View>
        )}
        {error && <ErrorBlock message={error} />}
      </ScrollView>
      <View style={styles.inputRow}>
        <TextInput
          style={styles.input}
          value={text}
          onChangeText={setText}
          placeholder="Ask your coach..."
          placeholderTextColor={color.textMuted}
          maxLength={1000}
          accessibilityLabel="Message"
          onSubmitEditing={() => send(text)}
          returnKeyType="send"
        />
        <Button label="Send" loading={sending} disabled={!text.trim()} onPress={() => send(text)} />
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  banner: { padding: spacing.xs, paddingHorizontal: spacing.md, backgroundColor: color.surface, borderBottomWidth: 1, borderBottomColor: color.border },
  messages: { padding: spacing.md, gap: spacing.xs },
  intro: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs, marginTop: spacing.xs },
  chip: { borderWidth: 1, borderColor: color.border, borderRadius: radius.pill, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs },
  chipText: { color: color.textSecondary, fontSize: typography.size.sm },
  bubble: { maxWidth: "88%", borderRadius: radius.md, padding: spacing.sm },
  user: { alignSelf: "flex-end", backgroundColor: color.accentMuted },
  assistant: { alignSelf: "flex-start", backgroundColor: color.surface, borderWidth: 1, borderColor: color.border },
  bubbleText: { color: color.textPrimary, fontSize: typography.size.md },
  muted: { color: color.textMuted, fontSize: typography.size.sm },
  inputRow: { flexDirection: "row", gap: spacing.xs, padding: spacing.sm, borderTopWidth: 1, borderTopColor: color.border, backgroundColor: color.surface, alignItems: "center" },
  input: {
    flex: 1,
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    color: color.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: typography.size.md,
  },
});
