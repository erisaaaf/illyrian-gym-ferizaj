import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { color, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { useApi } from "../../lib/use-api";
import { fmtDuration, label } from "../../lib/format";
import { Wod, WodExercise } from "../../lib/types";
import { Button, Card, Empty, ErrorBlock, Heading, Loading, Muted, Pill, Screen } from "../../components/ui";
import { LogWorkoutForm } from "../../components/log-workout-form";

function prescription(e: WodExercise) {
  const bits: string[] = [];
  if (e.sets && e.reps) bits.push(`${e.sets} x ${e.reps}`);
  else if (e.reps) bits.push(`${e.reps} reps`);
  if (e.weightKg) bits.push(`${Number(e.weightKg)} kg`);
  if (e.durationSeconds) bits.push(fmtDuration(e.durationSeconds));
  if (e.rounds) bits.push(`${e.rounds} round${e.rounds === 1 ? "" : "s"}`);
  if (e.timeCapSeconds) bits.push(`cap ${fmtDuration(e.timeCapSeconds)}`);
  return bits.join(" · ");
}

export default function WodScreen() {
  const { user } = useAuth();
  const wod = useApi<Wod | null>("/wods/today");
  const [logging, setLogging] = useState<string | null>(null); // exercise id, or "wod" for the whole workout
  const isMember = user?.role === "MEMBER";

  if (wod.loading && wod.data === null && !wod.error) return <Loading label="Loading today's workout..." />;

  return (
    <Screen onRefresh={wod.reload}>
      {wod.error && <ErrorBlock message={wod.error} onRetry={wod.reload} />}
      {!wod.error && !wod.data && <Empty title="No workout today" message="Today's WOD hasn't been published yet. Check back later or ask your coach." />}
      {wod.data && (
        <>
          <View>
            <Heading>{wod.data.title}</Heading>
            <View style={styles.meta}>
              <Pill label={label(wod.data.type)} tone="info" />
              {wod.data.status !== "PUBLISHED" && <Pill label={`${label(wod.data.status)} - members can't see this yet`} tone="warning" />}
            </View>
            {wod.data.description ? <Muted>{wod.data.description}</Muted> : null}
          </View>

          {wod.data.sections.map((section) => (
            <Card key={section.id} title={label(section.type)}>
              {section.notes ? <Muted>{section.notes}</Muted> : null}
              {section.exercises.map((e) => (
                <View key={e.id} style={styles.exercise}>
                  <View style={styles.rowBetween}>
                    <View style={{ flexShrink: 1 }}>
                      <Text style={styles.exName}>{e.exercise.name}</Text>
                      {prescription(e) ? <Text style={styles.rx}>{prescription(e)}</Text> : null}
                      {e.instructions ? <Muted>{e.instructions}</Muted> : null}
                      {e.scalingNotes ? <Muted>Scaling: {e.scalingNotes}</Muted> : null}
                    </View>
                    {isMember && logging !== e.exercise.id && (
                      <Button label="Log" small variant="secondary" onPress={() => setLogging(e.exercise.id)} />
                    )}
                  </View>
                  {isMember && logging === e.exercise.id && (
                    <LogWorkoutForm
                      wodId={wod.data!.id}
                      exerciseId={e.exercise.id}
                      measurementType={e.exercise.measurementType}
                      onCancel={() => setLogging(null)}
                    />
                  )}
                </View>
              ))}
            </Card>
          ))}

          {isMember && (
            <Card title="Whole workout">
              <Muted>Finished the full WOD? Record your overall result (time, rounds, reps or a note).</Muted>
              {logging === "wod" ? (
                <LogWorkoutForm wodId={wod.data.id} onCancel={() => setLogging(null)} />
              ) : (
                <Button label="Log WOD result" onPress={() => setLogging("wod")} />
              )}
            </Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  meta: { flexDirection: "row", gap: spacing.xs, marginVertical: spacing.xs, flexWrap: "wrap" },
  exercise: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs },
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start", gap: spacing.xs },
  exName: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  rx: { color: color.accent, fontSize: typography.size.sm, fontWeight: "600" },
});
