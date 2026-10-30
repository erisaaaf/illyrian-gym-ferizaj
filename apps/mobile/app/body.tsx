import { useState } from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { Stack } from "expo-router";
import { color, spacing, typography } from "@illyrian/config";
import { apiClient, ApiError } from "../lib/api-client";
import { useApi } from "../lib/use-api";
import { fmtDate } from "../lib/format";
import { Button, Card, ErrorBlock, Field, Loading, Muted, Screen } from "../components/ui";

interface Measurement {
  id: string;
  measuredAt: string;
  weightKg: string | null;
  bodyFatPercent: string | null;
  chestCm: string | null;
  waistCm: string | null;
  hipsCm: string | null;
  armCm: string | null;
  thighCm: string | null;
  sharedWithCoach: boolean;
}

const FIELDS: Array<{ key: keyof Measurement; label: string; api: string }> = [
  { key: "weightKg", label: "Weight (kg)", api: "weightKg" },
  { key: "bodyFatPercent", label: "Body fat (%)", api: "bodyFatPercent" },
  { key: "chestCm", label: "Chest (cm)", api: "chestCm" },
  { key: "waistCm", label: "Waist (cm)", api: "waistCm" },
  { key: "hipsCm", label: "Hips (cm)", api: "hipsCm" },
  { key: "armCm", label: "Arm (cm)", api: "armCm" },
  { key: "thighCm", label: "Thigh (cm)", api: "thighCm" },
];

/**
 * Body measurements. Private by default: nobody but you sees them unless you switch on "share with my trainer",
 * and then only your assigned trainer can. Photos are not available in the app yet.
 */
export default function BodyScreen() {
  const list = useApi<Measurement[]>("/body/measurements");
  const [values, setValues] = useState<Record<string, string>>({});
  const [share, setShare] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    setError(null);
    const body: Record<string, unknown> = { sharedWithCoach: share };
    for (const f of FIELDS) {
      const raw = (values[f.api] ?? "").trim().replace(",", ".");
      if (raw) {
        if (Number.isNaN(Number(raw))) return setError(`${f.label} must be a number.`);
        body[f.api] = Number(raw);
      }
    }
    if (Object.keys(body).length === 1) return setError("Enter at least one measurement.");
    setBusy(true);
    try {
      await apiClient.post("/body/measurements", body);
      setValues({});
      await list.reload();
    } catch (e) {
      setError(e instanceof ApiError ? (e.errors?.validation?.[0] ?? e.message) : "Could not save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Stack.Screen options={{ title: "Body measurements", headerStyle: { backgroundColor: color.surface }, headerTintColor: color.textPrimary }} />
      <Screen onRefresh={list.reload}>
        <Card title="Add a measurement">
          <Muted>Private to you unless you choose to share it with your trainer.</Muted>
          {error && <ErrorBlock message={error} />}
          <View style={styles.grid}>
            {FIELDS.map((f) => (
              <View key={f.api} style={{ width: "48%" }}>
                <Field label={f.label} value={values[f.api] ?? ""} onChangeText={(t) => setValues((v) => ({ ...v, [f.api]: t }))} keyboardType="decimal-pad" />
              </View>
            ))}
          </View>
          <View style={styles.shareRow}>
            <Text style={styles.strong}>Share with my trainer</Text>
            <Switch value={share} onValueChange={setShare} trackColor={{ true: color.accent, false: color.border }} thumbColor={color.textPrimary} accessibilityLabel="Share this measurement with my trainer" />
          </View>
          <Button label="Save measurement" onPress={add} loading={busy} />
        </Card>

        <Card title="History">
          {list.loading && !list.data && <Loading />}
          {list.error && <ErrorBlock message={list.error} onRetry={list.reload} />}
          {list.data?.length === 0 && <Muted>Nothing recorded yet.</Muted>}
          {list.data?.map((m) => (
            <View key={m.id} style={styles.line}>
              <Text style={styles.strong}>{fmtDate(m.measuredAt)}</Text>
              <Muted>{FIELDS.filter((f) => m[f.key] !== null && m[f.key] !== undefined).map((f) => `${f.label.replace(/ \(.*\)/, "")} ${m[f.key]}`).join(" · ")}</Muted>
              <View style={styles.shareRow}>
                <Muted>{m.sharedWithCoach ? "Shared with your trainer" : "Private"}</Muted>
                <View style={{ flexDirection: "row", gap: spacing.sm }}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => {
                      await apiClient.patch(`/body/measurements/${m.id}/share`, { sharedWithCoach: !m.sharedWithCoach });
                      await list.reload();
                    }}
                  >
                    <Text style={styles.link}>{m.sharedWithCoach ? "Stop sharing" : "Share"}</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={async () => {
                      await apiClient.delete(`/body/measurements/${m.id}`);
                      await list.reload();
                    }}
                  >
                    <Text style={[styles.link, { color: color.danger }]}>Delete</Text>
                  </Pressable>
                </View>
              </View>
            </View>
          ))}
        </Card>
      </Screen>
    </>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "space-between", rowGap: spacing.xs },
  shareRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginVertical: spacing.xs },
  strong: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  line: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs, gap: 4 },
  link: { color: color.accent, fontSize: typography.size.sm, fontWeight: "700" },
});
