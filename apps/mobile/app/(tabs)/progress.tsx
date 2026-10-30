import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, radius, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { useApi } from "../../lib/use-api";
import { fmtDate, fmtDuration, fmtPr } from "../../lib/format";
import { Paginated, PersonalRecord, PrHistoryEntry, ProgressSummary, WorkoutResultItem } from "../../lib/types";
import { Card, Empty, ErrorBlock, Heading, Loading, Muted, Pill, Screen, StatTile } from "../../components/ui";

export default function ProgressScreen() {
  const { user } = useAuth();
  const progress = useApi<ProgressSummary>("/progress/me");
  const prs = useApi<PersonalRecord[]>("/prs/me");
  const workouts = useApi<Paginated<WorkoutResultItem>>("/workouts/me?pageSize=10");
  const [openPr, setOpenPr] = useState<string | null>(null);

  if (user && user.role !== "MEMBER") {
    return (
      <Screen>
        <Empty title="Member feature" message="Progress tracking is for members. Trainers can verify member PRs from the admin dashboard." />
      </Screen>
    );
  }

  const reload = async () => {
    await Promise.all([progress.reload(), prs.reload(), workouts.reload()]);
  };

  if (progress.loading && !progress.data) return <Loading label="Loading your progress..." />;
  const error = progress.error ?? prs.error ?? workouts.error;
  const p = progress.data;
  const maxWeek = Math.max(1, ...(p?.weeklyTrainingDays.map((w) => w.trainingDays) ?? [0]));

  return (
    <Screen onRefresh={reload}>
      <Heading>Your progress</Heading>
      {error && <ErrorBlock message={error} onRetry={reload} />}

      {p && (
        <>
          <View style={styles.tiles}>
            <StatTile label="Day streak" value={p.currentStreakDays} />
            <StatTile label="Workouts logged" value={p.workoutsCompleted} />
            <StatTile label="Classes attended" value={p.classesAttended} />
            <StatTile label="Personal records" value={p.prCount} />
          </View>

          <Card title={`Training days · last 4 weeks (${p.trainingDaysLast30} in 30 days)`}>
            {[...p.weeklyTrainingDays].reverse().map((w) => (
              <View key={w.weeksAgo} style={styles.barRow} accessibilityLabel={`${w.weeksAgo === 0 ? "This week" : `${w.weeksAgo} weeks ago`}: ${w.trainingDays} training days`}>
                <Text style={styles.barLabel}>{w.weeksAgo === 0 ? "Last 7 days" : `${w.weeksAgo * 7 + 6}-${w.weeksAgo * 7} days ago`}</Text>
                <View style={styles.barTrack}>
                  <View style={[styles.barFill, { width: `${(w.trainingDays / maxWeek) * 100}%` }]} />
                </View>
                <Text style={styles.barValue}>{w.trainingDays}</Text>
              </View>
            ))}
          </Card>
        </>
      )}

      <Card title="Personal records">
        {prs.data && prs.data.length === 0 && <Muted>No PRs yet. Log a workout from the WOD tab and your records appear here automatically.</Muted>}
        {prs.data?.map((pr) => (
          <View key={pr.id} style={styles.prRow}>
            <Pressable onPress={() => setOpenPr(openPr === pr.id ? null : pr.id)} accessibilityRole="button" accessibilityLabel={`${pr.exercise.name} personal record`}>
              <View style={styles.rowBetween}>
                <View style={{ flexShrink: 1 }}>
                  <Text style={styles.prName}>{pr.exercise.name}</Text>
                  <Muted>{fmtDate(pr.achievedAt)}</Muted>
                </View>
                <View style={{ alignItems: "flex-end", gap: 4 }}>
                  <Text style={styles.prValue}>{fmtPr(pr.value, pr.unit)}</Text>
                  {pr.verificationStatus === "VERIFIED" ? <Pill label="Verified" tone="info" /> : null}
                </View>
              </View>
            </Pressable>
            {openPr === pr.id && <PrHistory exerciseId={pr.exerciseId} />}
          </View>
        ))}
      </Card>

      <Card title="Recent workouts">
        {workouts.data && workouts.data.data.length === 0 && <Muted>Nothing logged yet.</Muted>}
        {workouts.data?.data.map((w) => (
          <View key={w.id} style={styles.workoutRow}>
            <View style={styles.rowBetween}>
              <Text style={styles.prName}>{w.exercise?.name ?? w.wod?.title ?? "Workout"}</Text>
              <Muted>{fmtDate(w.completedAt)}</Muted>
            </View>
            <Muted>
              {[
                w.weightKg ? `${Number(w.weightKg)} kg` : null,
                w.reps ? `${w.reps} reps` : null,
                w.durationSeconds ? fmtDuration(w.durationSeconds) : null,
                w.rounds ? `${w.rounds} rounds` : null,
                w.distanceMeters ? `${Number(w.distanceMeters)} m` : null,
              ]
                .filter(Boolean)
                .join(" · ") || (w.wod ? w.wod.title : "")}
            </Muted>
          </View>
        ))}
      </Card>
    </Screen>
  );
}

function PrHistory({ exerciseId }: { exerciseId: string }) {
  const history = useApi<PrHistoryEntry[]>(`/prs/me/${exerciseId}/history`);
  if (history.loading && !history.data) return <Loading label="Loading history..." />;
  if (history.error) return <ErrorBlock message={history.error} onRetry={history.reload} />;
  return (
    <View style={styles.history}>
      {history.data?.map((h) => (
        <Text key={h.id} style={styles.historyRow}>
          {fmtDate(h.achievedAt)}: {h.previousValue !== null ? `${fmtPr(h.previousValue, h.unit)} → ` : ""}
          {fmtPr(h.newValue, h.unit)}
        </Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.xs },
  barRow: { flexDirection: "row", alignItems: "center", gap: spacing.xs },
  barLabel: { color: color.textSecondary, fontSize: typography.size.xs, width: 92 },
  barTrack: { flex: 1, height: 10, backgroundColor: color.surfaceElevated, borderRadius: radius.pill, overflow: "hidden" },
  barFill: { height: "100%", backgroundColor: color.accent, borderRadius: radius.pill },
  barValue: { color: color.textPrimary, fontSize: typography.size.sm, width: 18, textAlign: "right" },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.xs },
  prRow: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs },
  prName: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  prValue: { color: color.accent, fontSize: typography.size.lg, fontWeight: "700" },
  workoutRow: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs },
  history: { marginTop: spacing.xs, gap: 2 },
  historyRow: { color: color.textSecondary, fontSize: typography.size.sm },
});
