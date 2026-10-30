import { useState } from "react";
import { Redirect } from "expo-router";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../lib/auth-context";
import { apiClient, ApiError } from "../lib/api-client";
import { Button } from "../components/ui";

/**
 * First sign-in with a temporary password. The API refuses every other request until the password is changed
 * (server-enforced), so this screen is the only way forward. Afterwards the person signs in again.
 */
export default function ChangePasswordScreen() {
  const { user, loading, logout } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!loading && !user) return <Redirect href="/login" />;

  async function submit() {
    setError(null);
    if (next !== confirm) return setError("The two new passwords do not match.");
    setBusy(true);
    try {
      await apiClient.post("/auth/change-password", { currentPassword: current, newPassword: next });
      await logout(); // back to the sign-in screen: sign in again with the new password
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.validation?.[0] ?? e.message) : "Could not change the password. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === "ios" ? "padding" : undefined} style={styles.screen}>
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.card}>
          <Text style={styles.eyebrow}>FIRST SIGN-IN</Text>
          <Text style={styles.title}>Choose your password</Text>
          <Text style={styles.body}>You signed in with a temporary password. Choose your own before you continue. Only you should know it.</Text>

          {error ? (
            <View style={styles.errorBox} accessibilityRole="alert">
              <Text style={styles.errorText}>{error}</Text>
            </View>
          ) : null}

          <Text style={styles.label}>Temporary password</Text>
          <TextInput style={styles.input} value={current} onChangeText={setCurrent} secureTextEntry autoCapitalize="none" accessibilityLabel="Temporary password" />
          <Text style={styles.label}>New password</Text>
          <TextInput style={styles.input} value={next} onChangeText={setNext} secureTextEntry autoCapitalize="none" accessibilityLabel="New password" />
          <Text style={styles.hint}>At least 10 characters, with an uppercase letter, a lowercase letter and a number.</Text>
          <Text style={styles.label}>Repeat new password</Text>
          <TextInput style={styles.input} value={confirm} onChangeText={setConfirm} secureTextEntry autoCapitalize="none" accessibilityLabel="Repeat new password" />

          <Button label="Save password" onPress={submit} loading={busy} disabled={!current || !next || !confirm} />
          <View style={{ height: spacing.sm }} />
          <Button label="Sign out" variant="secondary" small onPress={() => void logout()} />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  scroll: { flexGrow: 1, justifyContent: "center", padding: spacing.lg },
  card: { backgroundColor: color.surface, borderRadius: radius.lg, borderWidth: 1, borderColor: color.border, padding: spacing.lg },
  eyebrow: { color: color.accent, fontSize: typography.size.xs, letterSpacing: 2.4, fontWeight: "700" },
  title: { color: color.textPrimary, fontSize: typography.size.xl, fontWeight: "800", marginTop: spacing.xs },
  body: { color: color.textSecondary, fontSize: typography.size.sm, marginTop: spacing.xs, marginBottom: spacing.lg },
  label: { color: color.textSecondary, fontSize: typography.size.xs, marginBottom: spacing.xxs },
  hint: { color: color.textMuted, fontSize: typography.size.xs, marginTop: -spacing.xs, marginBottom: spacing.md },
  input: { backgroundColor: color.surfaceElevated, borderWidth: 1, borderColor: color.border, borderRadius: radius.sm, color: color.textPrimary, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, marginBottom: spacing.md },
  errorBox: { borderWidth: 1, borderColor: color.danger, borderRadius: radius.md, padding: spacing.sm, marginBottom: spacing.md, backgroundColor: "rgba(255,97,89,0.1)" },
  errorText: { color: color.danger, fontSize: typography.size.sm },
});
