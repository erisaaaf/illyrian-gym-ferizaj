import { useState } from "react";
import { Redirect } from "expo-router";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../lib/auth-context";
import { ApiError, NetworkError } from "../lib/api-client";

export default function LoginScreen() {
  const { user, loading: sessionLoading, login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (!sessionLoading && user) {
    return <Redirect href={user.mustChangePassword ? "/change-password" : "/(tabs)"} />;
  }

  async function onSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      await login(email, password);
    } catch (e) {
      if (e instanceof ApiError) setError(e.message);
      else if (e instanceof NetworkError) {
        // The address is only shown in development builds; members never need to see it.
        setError(__DEV__ ? `${e.message}
(dev: no response from ${e.url})` : e.message);
      } else setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.screen}
    >
      <View style={styles.card}>
        <Text style={styles.title}>Illyrian Gym Ferizaj</Text>
        <Text style={styles.subtitle}>Welcome back</Text>

        {error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        <Text style={styles.label}>Email</Text>
        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          placeholder="you@example.com"
          placeholderTextColor={color.textMuted}
        />

        <Text style={styles.label}>Password</Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          placeholder="••••••••"
          placeholderTextColor={color.textMuted}
        />

        <Pressable style={styles.button} onPress={onSubmit} disabled={submitting}>
          {submitting ? (
            <ActivityIndicator color={color.accentContrast} />
          ) : (
            <Text style={styles.buttonText}>Sign in</Text>
          )}
        </Pressable>

        <Text style={styles.linkText}>
          Accounts are created by the gym. Don&apos;t have a login yet? Ask the front desk to set one up for you.
        </Text>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background, justifyContent: "center", padding: spacing.lg },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.lg,
  },
  title: { color: color.textPrimary, fontSize: typography.size.xl, fontWeight: "700" },
  subtitle: { color: color.textSecondary, fontSize: typography.size.sm, marginTop: spacing.xxs, marginBottom: spacing.lg },
  label: { color: color.textSecondary, fontSize: typography.size.xs, marginBottom: spacing.xxs },
  input: {
    backgroundColor: color.surfaceElevated,
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.sm,
    color: color.textPrimary,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
    marginBottom: spacing.md,
  },
  button: {
    backgroundColor: color.accent,
    borderRadius: radius.sm,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xxs,
  },
  buttonText: { color: color.accentContrast, fontWeight: "600" },
  errorBox: {
    backgroundColor: `${color.danger}1A`,
    borderWidth: 1,
    borderColor: `${color.danger}66`,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginBottom: spacing.md,
  },
  errorText: { color: color.danger, fontSize: typography.size.sm },
  linkText: { color: color.textSecondary, fontSize: typography.size.sm, textAlign: "center", marginTop: spacing.lg },
});
