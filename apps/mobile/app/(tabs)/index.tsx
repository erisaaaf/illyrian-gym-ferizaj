import { useMemo, useState } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { color, spacing, typography } from "@illyrian/config";
import { useAuth } from "../../lib/auth-context";
import { apiClient } from "../../lib/api-client";
import { useApi } from "../../lib/use-api";
import { fmtDate, fmtDateTime, fmtPr, label } from "../../lib/format";
import {
  AnnouncementItem,
  BookingItem,
  ClassItem,
  NotificationItem,
  Paginated,
  PersonalRecord,
  ProgressSummary,
  Wod,
} from "../../lib/types";
import { Button, Card, Heading, Loading, Muted, Pill, Screen, ErrorBlock } from "../../components/ui";

interface MyMembership {
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
  const isMember = user?.role === "MEMBER";

  return (
    <Screen>
      <Heading>Welcome back{user ? `, ${user.firstName}` : ""}</Heading>
      {isMember ? <MemberHome /> : <StaffHome />}
      <Announcements />
    </Screen>
  );
}

function MemberHome() {
  return (
    <>
      <MembershipCard />
      <TodaysPlanCard />
      <TodaysWodCard />
      <NextClassCard />
      <LatestPrCard />
      <StreakCard />
      <NotificationsCard />
    </>
  );
}

function StaffHome() {
  const { user } = useAuth();
  const me = useApi<{ id: string }>(user?.role === "COACH" ? "/coaches/me" : null);
  // Computed once: a new timestamp every render would change the path and re-fetch forever.
  const from = useMemo(() => encodeURIComponent(new Date(Date.now() - 3 * 3_600_000).toISOString()), []);
  const path =
    user?.role === "COACH" ? (me.data ? `/classes?coachId=${me.data.id}&status=SCHEDULED&from=${from}&pageSize=3` : null) : `/classes?status=SCHEDULED&from=${from}&pageSize=3`;
  const classes = useApi<Paginated<ClassItem>>(path);

  return (
    <>
      <TodaysWodCard />
      <Card title={user?.role === "COACH" ? "Your next classes" : "Next classes"}>
        {classes.loading && !classes.data && <Loading />}
        {classes.error && <ErrorBlock message={classes.error} onRetry={classes.reload} />}
        {classes.data?.data.length === 0 && <Muted>No upcoming classes.</Muted>}
        {classes.data?.data.map((c) => (
          <View key={c.id} style={styles.line}>
            <Text style={styles.strong}>{c.title}</Text>
            <Muted>{fmtDateTime(c.startTime)} · {c.bookedCount}/{c.capacity} booked</Muted>
          </View>
        ))}
      </Card>
    </>
  );
}

function MembershipCard() {
  const membership = useApi<MyMembership | null>("/memberships/me");
  if (membership.error) return <Card title="Membership"><ErrorBlock message={membership.error} onRetry={membership.reload} /></Card>;
  if (membership.loading && membership.data === null) return <Card title="Membership"><Loading /></Card>;
  const m = membership.data;
  if (!m) return <Card title="Membership"><Muted>You don't have a membership yet. The gym will assign one for you.</Muted></Card>;

  const bad = m.computedStatus === "EXPIRED" || m.computedStatus === "CANCELLED";
  return (
    <Card title="Membership">
      <Text style={styles.big}>{m.plan.name}</Text>
      <Text style={[styles.status, { color: bad ? color.danger : m.computedStatus === "EXPIRING_SOON" ? color.warning : color.success }]}>
        {STATUS_LABEL[m.computedStatus]}
      </Text>
      <Muted>Valid until {new Date(m.endDate).toLocaleDateString()} · Payment {m.paymentStatus.toLowerCase()}</Muted>
    </Card>
  );
}

interface PlanItem {
  id: string;
  sets: number | null;
  reps: number | null;
  weightKg: string | null;
  durationSeconds: number | null;
  notes: string | null;
  exercise: { name: string };
}
interface MyPlans {
  plans: Array<{ id: string; title: string; goal: string | null; isCurrent: boolean; todayItems: PlanItem[]; adherence: { percent: number | null } }>;
}

/** The session your trainer planned for today. Only shown when a trainer has assigned a plan. */
function TodaysPlanCard() {
  const plans = useApi<MyPlans>("/me/workout-plans");
  const current = plans.data?.plans.find((p) => p.isCurrent);
  if (plans.error || !current) return null;
  return (
    <Card title="Today's plan from your trainer">
      <Text style={styles.big}>{current.title}</Text>
      {current.goal ? <Muted>{current.goal}</Muted> : null}
      {current.todayItems.length === 0 ? (
        <Muted>Rest day. Nothing is planned for today.</Muted>
      ) : (
        current.todayItems.map((it) => (
          <View key={it.id} style={styles.line}>
            <Text style={styles.strong}>{it.exercise.name}</Text>
            <Muted>
              {[it.sets && it.reps ? `${it.sets} × ${it.reps}` : it.reps ? `${it.reps} reps` : null, it.weightKg ? `${Number(it.weightKg)} kg` : null, it.durationSeconds ? `${Math.round(it.durationSeconds / 60)} min` : null, it.notes].filter(Boolean).join(" · ")}
            </Muted>
          </View>
        ))
      )}
      {current.adherence.percent !== null ? <Muted>You have followed {current.adherence.percent}% of this plan so far.</Muted> : null}
    </Card>
  );
}

function TodaysWodCard() {
  const router = useRouter();
  const wod = useApi<Wod | null>("/wods/today");
  return (
    <Card title="Today's WOD">
      {wod.loading && wod.data === null && !wod.error && <Loading />}
      {wod.error && <ErrorBlock message={wod.error} onRetry={wod.reload} />}
      {!wod.loading && !wod.error && !wod.data && <Muted>No workout published for today yet.</Muted>}
      {wod.data && (
        <>
          <Text style={styles.big}>{wod.data.title}</Text>
          <View style={{ flexDirection: "row", gap: spacing.xs }}>
            <Pill label={label(wod.data.type)} tone="info" />
            {wod.data.status !== "PUBLISHED" && <Pill label="Draft" tone="warning" />}
          </View>
          <Muted>{wod.data.sections.length} section{wod.data.sections.length === 1 ? "" : "s"} · {wod.data.sections.reduce((n, s) => n + s.exercises.length, 0)} exercises</Muted>
          <Button label="View workout" variant="secondary" small onPress={() => router.push("/wod")} />
        </>
      )}
    </Card>
  );
}

function NextClassCard() {
  const router = useRouter();
  const bookings = useApi<Paginated<BookingItem>>("/bookings/me?upcoming=true&pageSize=1");
  const next = bookings.data?.data[0];
  return (
    <Card title="Next class">
      {bookings.loading && !bookings.data && <Loading />}
      {bookings.error && <ErrorBlock message={bookings.error} onRetry={bookings.reload} />}
      {bookings.data && !next && (
        <>
          <Muted>You have no upcoming bookings.</Muted>
          <Button label="Find a class" variant="secondary" small onPress={() => router.push("/schedule")} />
        </>
      )}
      {next && (
        <>
          <Text style={styles.big}>{next.class.title}</Text>
          <Muted>{fmtDateTime(next.class.startTime)}</Muted>
          <Pill label={next.status === "WAITLISTED" ? "Waitlisted" : "Booked"} tone={next.status === "WAITLISTED" ? "warning" : "success"} />
        </>
      )}
    </Card>
  );
}

function LatestPrCard() {
  const prs = useApi<PersonalRecord[]>("/prs/me");
  const latest = prs.data && prs.data.length > 0 ? [...prs.data].sort((a, b) => +new Date(b.achievedAt) - +new Date(a.achievedAt))[0] : null;
  return (
    <Card title="Latest PR">
      {prs.loading && !prs.data && <Loading />}
      {prs.error && <ErrorBlock message={prs.error} onRetry={prs.reload} />}
      {prs.data && !latest && <Muted>No personal records yet - log a workout to set your first one.</Muted>}
      {latest && (
        <>
          <Text style={styles.big}>{latest.exercise.name}</Text>
          <Text style={[styles.status, { color: color.accent }]}>{fmtPr(latest.value, latest.unit)}</Text>
          <Muted>{fmtDate(latest.achievedAt)}</Muted>
        </>
      )}
    </Card>
  );
}

function StreakCard() {
  const progress = useApi<ProgressSummary>("/progress/me");
  return (
    <Card title="Consistency">
      {progress.loading && !progress.data && <Loading />}
      {progress.error && <ErrorBlock message={progress.error} onRetry={progress.reload} />}
      {progress.data && (
        <>
          <Text style={styles.big}>{progress.data.currentStreakDays}-day streak</Text>
          <Muted>{progress.data.trainingDaysLast30} training days in the last 30 · {progress.data.workoutsCompleted} workouts logged</Muted>
        </>
      )}
    </Card>
  );
}

function NotificationsCard() {
  const list = useApi<Paginated<NotificationItem>>("/notifications/me?pageSize=3");
  const [busy, setBusy] = useState(false);
  const unread = list.data?.data.filter((n) => !n.readAt).length ?? 0;

  async function markAll() {
    setBusy(true);
    try {
      await apiClient.patch("/notifications/me/read-all");
      await list.reload();
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card title={`Notifications${unread ? ` · ${unread} new` : ""}`}>
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error} onRetry={list.reload} />}
      {list.data?.data.length === 0 && <Muted>You're all caught up.</Muted>}
      {list.data?.data.map((n) => (
        <Pressable key={n.id} style={styles.line} onPress={async () => { if (!n.readAt) { await apiClient.patch(`/notifications/me/${n.id}/read`); await list.reload(); } }}>
          <Text style={[styles.strong, !n.readAt && { color: color.accent }]}>{n.title}</Text>
          <Muted>{n.body}</Muted>
        </Pressable>
      ))}
      {unread > 0 && <Button label="Mark all as read" variant="secondary" small loading={busy} onPress={markAll} />}
    </Card>
  );
}

function Announcements() {
  const list = useApi<Paginated<AnnouncementItem>>("/announcements?pageSize=3");
  return (
    <Card title="Announcements">
      {list.loading && !list.data && <Loading />}
      {list.error && <ErrorBlock message={list.error} onRetry={list.reload} />}
      {list.data?.data.length === 0 && <Muted>No announcements right now.</Muted>}
      {list.data?.data.map((a) => (
        <View key={a.id} style={styles.line}>
          <View style={{ flexDirection: "row", gap: spacing.xs, alignItems: "center", flexWrap: "wrap" }}>
            <Text style={styles.strong}>{a.title}</Text>
            {a.priority !== "NORMAL" && <Pill label={label(a.priority)} tone={a.priority === "URGENT" ? "danger" : "warning"} />}
          </View>
          <Muted>{a.content}</Muted>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  big: { color: color.textPrimary, fontSize: typography.size.lg, fontWeight: "700" },
  status: { fontSize: typography.size.md, fontWeight: "600" },
  strong: { color: color.textPrimary, fontSize: typography.size.md, fontWeight: "600" },
  line: { borderTopWidth: 1, borderTopColor: color.border, paddingTop: spacing.xs, marginTop: spacing.xs, gap: 2 },
});
