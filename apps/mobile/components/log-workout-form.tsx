import { useState } from "react";
import { StyleSheet, Text, View } from "react-native";
import { color, spacing, typography } from "@illyrian/config";
import { apiClient } from "../lib/api-client";
import { errorMessage } from "../lib/use-api";
import { fmtPr, parseDuration } from "../lib/format";
import { MeasurementType, WorkoutRecordResponse } from "../lib/types";
import { Button, ErrorBlock, Field } from "./ui";

/**
 * Logs one workout result. Which inputs appear follows the exercise's
 * measurement type; with no type (a whole-WOD result) every input is offered.
 * The server decides whether the result is a new PR - the outcome is shown here.
 */
export function LogWorkoutForm({
  wodId,
  exerciseId,
  measurementType,
  onLogged,
  onCancel,
}: {
  wodId?: string;
  exerciseId?: string;
  measurementType?: MeasurementType;
  onLogged?: () => void;
  onCancel: () => void;
}) {
  const [weight, setWeight] = useState("");
  const [reps, setReps] = useState("");
  const [time, setTime] = useState("");
  const [distance, setDistance] = useState("");
  const [rounds, setRounds] = useState("");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [outcome, setOutcome] = useState<WorkoutRecordResponse | null>(null);

  const show = (t: MeasurementType, extra?: MeasurementType[]) => !measurementType || measurementType === t || !!extra?.includes(measurementType);

  async function submit() {
    setError(null);
    const body: Record<string, unknown> = { wodId, exerciseId };
    const num = (label: string, text: string, integer = false) => {
      if (!text.trim()) return undefined;
      const n = Number(text.replace(",", "."));
      if (!Number.isFinite(n) || n <= 0 || (integer && !Number.isInteger(n))) throw new Error(`${label} must be a positive ${integer ? "whole " : ""}number`);
      return n;
    };
    try {
      body.weightKg = num("Weight", weight);
      body.reps = num("Reps", reps, true);
      body.distanceMeters = num("Distance", distance);
      body.rounds = num("Rounds", rounds, true);
      if (time.trim()) {
        const seconds = parseDuration(time);
        if (!seconds) throw new Error("Time must look like 2:05 or a number of seconds");
        body.durationSeconds = seconds;
      }
      if (notes.trim()) body.notes = notes.trim();
      if (!exerciseId && !body.weightKg && !body.reps && !body.distanceMeters && !body.rounds && !body.durationSeconds && !body.notes) {
        throw new Error("Enter at least one result (time, rounds, reps...) or a note");
      }
    } catch (e) {
      setError((e as Error).message);
      return;
    }

    setBusy(true);
    try {
      setOutcome(await apiClient.post<WorkoutRecordResponse>("/workouts", body));
      onLogged?.();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  if (outcome) {
    const pr = outcome.prOutcome;
    return (
      <View style={styles.box} accessibilityLabel="Workout logged">
        <Text style={styles.done}>Workout logged</Text>
        {pr?.isNewPr && pr.personalRecord ? (
          <Text style={styles.pr} accessibilityLabel="New personal record">
            New PR! {fmtPr(pr.personalRecord.value, pr.personalRecord.unit)}
            {pr.previousValue !== null ? ` (previous best ${fmtPr(pr.previousValue, pr.personalRecord.unit)})` : " - your first record on this lift"}
          </Text>
        ) : pr ? (
          <Text style={styles.muted}>Not a new PR this time - keep pushing.</Text>
        ) : null}
        <Button label="Done" variant="secondary" small onPress={onCancel} />
      </View>
    );
  }

  return (
    <View style={styles.box}>
      {error && <ErrorBlock message={error} />}
      <View style={styles.row}>
        {show("WEIGHT") && <Field label="Weight (kg)" keyboardType="decimal-pad" value={weight} onChangeText={setWeight} />}
        {show("WEIGHT", ["REPS"]) && <Field label="Reps" keyboardType="number-pad" value={reps} onChangeText={setReps} />}
        {show("TIME") && <Field label="Time (m:ss)" placeholder="2:05" value={time} onChangeText={setTime} autoCapitalize="none" />}
        {show("DISTANCE") && <Field label="Distance (m)" keyboardType="decimal-pad" value={distance} onChangeText={setDistance} />}
        {show("ROUNDS") && <Field label="Rounds" keyboardType="number-pad" value={rounds} onChangeText={setRounds} />}
      </View>
      <Field label="Notes (optional)" value={notes} onChangeText={setNotes} />
      <View style={styles.row}>
        <Button label="Save result" loading={busy} onPress={submit} />
        <Button label="Cancel" variant="secondary" onPress={onCancel} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  box: { gap: spacing.xs, marginTop: spacing.xs, borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs },
  row: { flexDirection: "row", gap: spacing.xs, flexWrap: "wrap", alignItems: "flex-end" },
  done: { color: color.success, fontWeight: "700", fontSize: typography.size.md },
  pr: { color: color.warning, fontWeight: "700", fontSize: typography.size.md },
  muted: { color: color.textMuted, fontSize: typography.size.sm },
});
