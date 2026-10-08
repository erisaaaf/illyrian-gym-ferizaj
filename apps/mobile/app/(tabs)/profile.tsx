import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrator", COACH: "Trainer", MEMBER: "Member" };

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);

  async function onLogout() {
    setLoggingOut(true);
    await logout();
    setLoggingOut(false);
  }

  return (
    <View style={styles.screen}>
      <Text style={styles.name}>
        {user?.firstName} {user?.lastName}
      </Text>
      <Text style={styles.email}>{user?.email}</Text>
      <Text style={styles.role}>{user ? (ROLE_LABEL[user.role] ?? user.role) : ""}</Text>

      <Pressable style={styles.button} onPress={onLogout} disabled={loggingOut}>
        {loggingOut ? <ActivityIndicator color={color.textPrimary} /> : <Text style={styles.buttonText}>Sign out</Text>}
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background, padding: spacing.md },
  name: { color: color.textPrimary, fontSize: typography.size.lg, fontWeight: "700" },
  email: { color: color.textSecondary, fontSize: typography.size.sm, marginTop: spacing.xxs },
  role: { color: color.textMuted, fontSize: typography.size.xs, marginTop: spacing.xxs },
  button: {
    borderWidth: 1,
    borderColor: color.border,
    borderRadius: radius.md,
    paddingVertical: spacing.sm,
    alignItems: "center",
    marginTop: spacing.xl,
  },
  buttonText: { color: color.textPrimary, fontWeight: "600" },
});
