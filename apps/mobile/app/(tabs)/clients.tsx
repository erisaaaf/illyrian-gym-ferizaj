import { useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { color, spacing, typography } from "@illyrian/config";
import { apiClient, ApiError } from "../../lib/api-client";
import { useApi } from "../../lib/use-api";
import { fmtDate } from "../../lib/format";
import { Button, Card, Empty, ErrorBlock, Field, Loading, Muted, Pill, Screen } from "../../components/ui";

interface ClientRow {
  id: string;
  firstName: string;
  lastName: string;
  memberNumber: string | null;
  membershipStatus: string;
  lastVisitAt: string | null;
  workoutsLast30Days: number;
  activePlans: number;
}
interface ClientDetail {
  id: string;
  firstName: string;
  lastName: string;
  progress: { workoutsCompleted: number; trainingDaysLast30: number; currentStreakDays: number; prCount: number };
  plans: Array<{ id: string; title: string; adherence: { percent: number | null } }>;
  notes: Array<{ id: string; body: string; createdAt: string }>;
}

/** A trainer's own clients (the API only returns the ones assigned to them): coaching data and notes, never payments. */
export default function ClientsScreen() {
  const list = useApi<{ data: ClientRow[] }>("/clients?pageSize=100");
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <Screen onRefresh={list.reload}>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error} onRetry={list.reload} />}
      {list.data?.data.length === 0 && <Empty title="No clients yet" message="Members assigned to you appear here." />}
      {list.data?.data.map((c) => (
        <View key={c.id}>
          <Pressable onPress={() => setOpenId(openId === c.id ? null : c.id)} accessibilityRole="button" accessibilityLabel={`${c.firstName} ${c.lastName}`}>
            <Card>
              <View style={styles.row}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.strong}>
                    {c.firstName} {c.lastName}
                  </Text>
                  <Muted>
                    {c.memberNumber} · last visit {c.lastVisitAt ? fmtDate(c.lastVisitAt) : "never"} · {c.workoutsLast30Days} workouts (30d)
                  </Muted>
                </View>
                <Pill label={c.activePlans > 0 ? `${c.activePlans} plan` : "No plan"} tone={c.activePlans > 0 ? "success" : "warning"} />
              </View>
            </Card>
          </Pressable>
          {openId === c.id && <ClientPanel id={c.id} />}
        </View>
      ))}
    </Screen>
  );
}

function ClientPanel({ id }: { id: string }) {
  const detail = useApi<ClientDetail>(`/clients/${id}`);
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function addNote() {
    setBusy(true);
    setError(null);
    try {
      await apiClient.post(`/clients/${id}/notes`, { body: note });
      setNote("");
      await detail.reload();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not save the note.");
    } finally {
      setBusy(false);
    }
  }

  if (detail.loading && !detail.data) return <Loading />;
  if (detail.error) return <ErrorBlock message={detail.error} onRetry={detail.reload} />;
  const d = detail.data;
  if (!d) return null;
  return (
    <Card title="Progress">
      <Muted>
        {d.progress.workoutsCompleted} workouts · {d.progress.trainingDaysLast30} training days (30d) · {d.progress.currentStreakDays}-day streak · {d.progress.prCount} records
      </Muted>
      {d.plans.map((p) => (
        <Text key={p.id} style={styles.small}>
          {p.title}: {p.adherence.percent === null ? "no sessions yet" : `${p.adherence.percent}% followed`}
        </Text>
      ))}
      <Text style={[styles.strong, { marginTop: spacing.xs }]}>Notes</Text>
      {d.notes.length === 0 && <Muted>No notes yet.</Muted>}
      {d.notes.slice(0, 5).map((n) => (
        <View key={n.id} style={styles.line}>
          <Text style={styles.small}>{n.body}</Text>
          <Muted>{fmtDate(n.createdAt)}</Muted>
        </View>
      ))}
      {error && <ErrorBlock message={error} />}
      <Field label="Add a note (staff only)" value={note} onChangeText={setNote} multiline />
      <Button label="Save note" small onPress={addNote} loading={busy} disabled={!note.trim()} />
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  strong: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  small: { color: color.textPrimary, fontSize: typography.size.sm },
  line: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs, gap: 2 },
});
