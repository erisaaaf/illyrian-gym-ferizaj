import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { Muted } from "../../components/ui";

const ROLE_LABEL: Record<string, string> = { ADMIN: "Administrator", RECEPTIONIST: "Reception", COACH: "Trainer", MEMBER: "Member" };

function RowLink({ label, hint, onPress }: { label: string; hint: string; onPress: () => void }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        <Muted>{hint}</Muted>
      </View>
      <Text style={styles.chevron}>›</Text>
    </Pressable>
  );
}

export default function ProfileScreen() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [loggingOut, setLoggingOut] = useState(false);
  const isMember = user?.role === "MEMBER";

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

      {isMember && (
        <View style={styles.links}>
          <RowLink label="Payments & invoices" hint="What you owe, what you paid, invoice PDFs" onPress={() => router.push("/billing")} />
          <RowLink label="Body measurements" hint="Private to you unless you share them" onPress={() => router.push("/body")} />
        </View>
      )}

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
  links: { marginTop: spacing.lg, backgroundColor: color.surface, borderRadius: radius.md, borderWidth: 1, borderColor: color.border },
  link: { flexDirection: "row", alignItems: "center", padding: spacing.md, borderBottomWidth: 1, borderBottomColor: color.border, gap: spacing.sm },
  linkLabel: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  chevron: { color: color.accent, fontSize: typography.size.xl },
  button: { borderWidth: 1, borderColor: color.border, borderRadius: radius.md, paddingVertical: spacing.sm, alignItems: "center", marginTop: spacing.xl },
  buttonText: { color: color.textPrimary, fontWeight: "600" },
});
