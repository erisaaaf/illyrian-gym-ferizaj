import { useMemo, useState } from "react";
import { Text, View, StyleSheet } from "react-native";
import { color, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api-client";
import { errorMessage, useApi } from "../../lib/use-api";
import { fmtDateTime } from "../../lib/format";
import { BookingItem, ClassItem, Paginated, Participant } from "../../lib/types";
import { Button, Card, Empty, ErrorBlock, Heading, Loading, Muted, Pill, Screen } from "../../components/ui";

export default function ScheduleScreen() {
  const { user } = useAuth();
  return user?.role === "MEMBER" ? <MemberSchedule /> : <StaffSchedule />;
}

/* ------------------------------ Member ------------------------------ */

function MemberSchedule() {
  // Anchor "now" once per mount so the query string is stable between renders.
  const from = useMemo(() => encodeURIComponent(new Date().toISOString()), []);
  const classes = useApi<Paginated<ClassItem>>(`/classes?status=SCHEDULED&from=${from}&pageSize=50`);
  const bookings = useApi<Paginated<BookingItem>>("/bookings/me?upcoming=true&pageSize=50");

  const byClass = useMemo(() => {
    const map = new Map<string, BookingItem>();
    for (const b of bookings.data?.data ?? []) map.set(b.class.id, b);
    return map;
  }, [bookings.data]);

  const reload = async () => {
    await Promise.all([classes.reload(), bookings.reload()]);
  };

  if ((classes.loading || bookings.loading) && !classes.data) return <Loading label="Loading classes..." />;

  return (
    <Screen onRefresh={reload}>
      <Heading>Classes</Heading>
      {classes.error && <ErrorBlock message={classes.error} onRetry={reload} />}
      {bookings.error && <ErrorBlock message={bookings.error} onRetry={reload} />}
      {classes.data && classes.data.data.length === 0 && (
        <Empty title="No upcoming classes" message="Nothing is scheduled yet. Check back soon." />
      )}
      {classes.data?.data.map((c) => (
        <ClassCard key={c.id} cls={c} booking={byClass.get(c.id)} onChanged={reload} />
      ))}
    </Screen>
  );
}

function ClassCard({ cls, booking, onChanged }: { cls: ClassItem; booking?: BookingItem; onChanged: () => Promise<void> }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const spotsLeft = cls.capacity - cls.bookedCount;
  const full = spotsLeft <= 0;

  async function run(action: () => Promise<unknown>) {
    setBusy(true);
    setError(null);
    try {
      await action();
      await onChanged();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card accessibilityLabel={`Class ${cls.title}`}>
      <View style={styles.rowBetween}>
        <Text style={styles.title}>{cls.title}</Text>
        {booking?.status === "BOOKED" && <Pill label="Booked" tone="success" />}
        {booking?.status === "WAITLISTED" && <Pill label="Waitlisted" tone="warning" />}
      </View>
      <Text style={styles.when}>{fmtDateTime(cls.startTime)}</Text>
      {cls.coach && <Muted>Coach {cls.coach.user.firstName} {cls.coach.user.lastName}</Muted>}
      <Muted>{full ? "Class is full" : `${spotsLeft} of ${cls.capacity} spots left`}</Muted>
      {error && <ErrorBlock message={error} />}
      <View style={{ marginTop: spacing.xs }}>
        {!booking && (
          <Button
            label={full ? "Join waitlist" : "Book class"}
            variant={full ? "secondary" : "primary"}
            loading={busy}
            onPress={() => run(() => apiClient.post("/bookings", { classId: cls.id }))}
          />
        )}
        {booking && (
          <Button
            label={booking.status === "WAITLISTED" ? "Leave waitlist" : "Cancel booking"}
            variant="secondary"
            loading={busy}
            onPress={() => run(() => apiClient.patch(`/bookings/${booking.id}/cancel`))}
          />
        )}
      </View>
    </Card>
  );
}

/* ------------------------------ Trainer / Admin ------------------------------ */

function StaffSchedule() {
  const { user } = useAuth();
  const isCoach = user?.role === "COACH";
  const me = useApi<{ id: string }>(isCoach ? "/coaches/me" : null);
  // Include classes that started up to 12h ago so a trainer can still check people in after class begins.
  const from = useMemo(() => encodeURIComponent(new Date(Date.now() - 12 * 3_600_000).toISOString()), []);
  const path = isCoach ? (me.data ? `/classes?coachId=${me.data.id}&status=SCHEDULED&from=${from}&pageSize=50` : null) : `/classes?status=SCHEDULED&from=${from}&pageSize=50`;
  const classes = useApi<Paginated<ClassItem>>(path);

  if ((me.loading || classes.loading) && !classes.data) return <Loading label="Loading your classes..." />;
  const error = me.error ?? classes.error;

  return (
    <Screen onRefresh={async () => { await classes.reload(); }}>
      <Heading>{isCoach ? "Your classes" : "Classes"}</Heading>
      {error && <ErrorBlock message={error} onRetry={classes.reload} />}
      {classes.data && classes.data.data.length === 0 && (
        <Empty title="No classes assigned" message="When the gym assigns you a class it will appear here." />
      )}
      {classes.data?.data.map((c) => (
        <StaffClassCard key={c.id} cls={c} />
      ))}
    </Screen>
  );
}

function StaffClassCard({ cls }: { cls: ClassItem }) {
  const [open, setOpen] = useState(false);
  return (
    <Card accessibilityLabel={`Class ${cls.title}`}>
      <Text style={styles.title}>{cls.title}</Text>
      <Text style={styles.when}>{fmtDateTime(cls.startTime)}</Text>
      <Muted>{cls.bookedCount} of {cls.capacity} booked</Muted>
      <View style={{ marginTop: spacing.xs }}>
        <Button label={open ? "Hide participants" : "Participants & check-in"} variant="secondary" small onPress={() => setOpen((v) => !v)} />
      </View>
      {open && <Participants classId={cls.id} />}
    </Card>
  );
}

function Participants({ classId }: { classId: string }) {
  const list = useApi<Participant[]>(`/classes/${classId}/participants`);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function mark(p: Participant, status: "CHECKED_IN" | "NO_SHOW") {
    setBusyId(p.user.id);
    setError(null);
    try {
      await apiClient.post("/admin/attendance", { userId: p.user.id, classId, status });
      await list.reload();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusyId(null);
    }
  }

  if (list.loading && !list.data) return <Loading label="Loading participants..." />;
  if (list.error) return <ErrorBlock message={list.error} onRetry={list.reload} />;
  if (!list.data || list.data.length === 0) return <Muted>No bookings for this class yet.</Muted>;

  return (
    <View style={{ gap: spacing.xs, marginTop: spacing.xs }}>
      {error && <ErrorBlock message={error} />}
      {list.data.map((p) => (
        <View key={p.id} style={styles.participant}>
          <View style={styles.rowBetween}>
            <Text style={styles.name}>{p.user.firstName} {p.user.lastName}</Text>
            <Pill
              label={p.status === "ATTENDED" ? "Checked in" : p.status === "NO_SHOW" ? "No show" : p.status === "WAITLISTED" ? "Waitlist" : "Booked"}
              tone={p.status === "ATTENDED" ? "success" : p.status === "NO_SHOW" ? "danger" : p.status === "WAITLISTED" ? "warning" : "neutral"}
            />
          </View>
          {p.status !== "WAITLISTED" && (
            <View style={styles.actions}>
              {p.status !== "ATTENDED" && <Button label="Check in" small loading={busyId === p.user.id} onPress={() => mark(p, "CHECKED_IN")} />}
              {p.status !== "NO_SHOW" && <Button label="No show" small variant="secondary" loading={busyId === p.user.id} onPress={() => mark(p, "NO_SHOW")} />}
            </View>
          )}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  rowBetween: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", gap: spacing.xs },
  title: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "700", flexShrink: 1 },
  when: { color: color.textSecondary, fontSize: typography.size.sm },
  name: { color: color.textPrimary, fontSize: typography.size.sm, fontWeight: "600" },
  participant: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, gap: spacing.xs },
  actions: { flexDirection: "row", gap: spacing.xs },
});
