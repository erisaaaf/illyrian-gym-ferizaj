import { useCallback, useEffect, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api-client";
import { EmptyState } from "../../components/empty-state";

interface MyMembership {
  startDate: string;
  endDate: string;
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
  computedStatus: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";
  plan: { name: string };
}

const STATUS_LABEL: Record<MyMembership["computedStatus"], string> = {
  ACTIVE: "Active",
  EXPIRING_SOON: "Expiring soon",
  EXPIRED: "Expired",
  CANCELLED: "Cancelled",
};

export default function HomeScreen() {
  const { user } = useAuth();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={{ padding: spacing.md, paddingTop: insets.top + spacing.md, gap: spacing.md }}
    >
      <Text style={styles.greeting}>Welcome back{user ? `, ${user.firstName}` : ""}</Text>

      {user?.role === "MEMBER" && <MembershipCard />}

      <EmptyState title="Today's WOD" message="Today's workout lands here in Phase 2." />
      <EmptyState title="Next Class" message="Class schedule and booking land here in Phase 2." />
      <EmptyState title="Latest PR" message="Personal records land here in Phase 4." />
      <EmptyState title="Announcements" message="Gym announcements land here in Phase 6." />
    </ScrollView>
  );
}

function MembershipCard() {
  const [membership, setMembership] = useState<MyMembership | null | undefined>(undefined);
  const [failed, setFailed] = useState(false);

  const load = useCallback(async () => {
    setFailed(false);
    try {
      setMembership(await apiClient.get<MyMembership | null>("/memberships/me"));
    } catch {
      setFailed(true);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  if (failed) return <EmptyState title="Membership" message="Couldn't load your membership. Please try again in a moment." />;
  if (membership === undefined) {
    return (
      <View style={styles.card}>
        <ActivityIndicator color={color.accent} />
      </View>
    );
  }
  if (membership === null) {
    return <EmptyState title="Membership" message="You don't have a membership yet. The gym will assign one for you." />;
  }

  const bad = membership.computedStatus === "EXPIRED" || membership.computedStatus === "CANCELLED";
  return (
    <View style={styles.card} accessibilityLabel="Membership">
      <Text style={styles.cardLabel}>Membership</Text>
      <Text style={styles.planName}>{membership.plan.name}</Text>
      <Text style={[styles.status, { color: bad ? color.danger : color.success }]}>
        {STATUS_LABEL[membership.computedStatus]}
      </Text>
      <Text style={styles.meta}>
        Valid until {new Date(membership.endDate).toLocaleDateString()} · Payment {membership.paymentStatus.toLowerCase()}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: color.background },
  greeting: { color: color.textPrimary, fontSize: typography.size.xl, fontWeight: "700" },
  card: {
    backgroundColor: color.surface,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: color.border,
    padding: spacing.md,
  },
  cardLabel: { color: color.textMuted, fontSize: typography.size.xs, marginBottom: spacing.xxs },
  planName: { color: color.textPrimary, fontSize: typography.size.lg, fontWeight: "700" },
  status: { fontSize: typography.size.sm, fontWeight: "600", marginTop: spacing.xxs },
  meta: { color: color.textSecondary, fontSize: typography.size.sm, marginTop: spacing.xs },
});
