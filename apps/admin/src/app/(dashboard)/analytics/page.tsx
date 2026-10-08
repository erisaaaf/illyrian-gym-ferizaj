"use client";

import { useOverview } from "../../../lib/use-overview";
import { PageHeader } from "../../../components/ui/page-header";
import { LoadingState, ErrorState } from "../../../components/ui/states";
import { Button } from "../../../components/ui/button";
import { BarRow, StatCard } from "../../../components/stat-card";

export default function AnalyticsPage() {
  const { overview, loading, error, reload } = useOverview();

  if (loading) return <LoadingState label="Loading analytics..." />;
  if (error || !overview) return <ErrorState message={error ?? "No data."} onRetry={reload} />;

  const { members, memberships, classes, bookings, training, challenges } = overview;
  const trainingMax = Math.max(training.attendanceLast30Days, training.workoutsLast30Days, training.newPrsLast30Days);
  const nothingYet = members.total === 0 && trainingMax === 0 && classes.upcoming === 0;

  return (
    <div>
      <PageHeader
        title="Analytics"
        description={`Live figures from the database as of ${new Date(overview.generatedAt).toLocaleString()}.`}
        action={
          <Button variant="secondary" onClick={reload}>
            Refresh
          </Button>
        }
      />

      {nothingYet && (
        <p className="mb-5 rounded-md border border-dashed border-border bg-surface p-4 text-sm text-text-secondary">
          There isn&apos;t any data to chart yet. Add members, schedule classes and let people log workouts, and these
          numbers fill in on their own.
        </p>
      )}

      <h2 className="mb-2 text-sm font-semibold text-text-primary">Members</h2>
      <div className="mb-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Total members" value={members.total} />
        <StatCard label="Active members" value={members.active} tone="success" />
        <StatCard label="Memberships expiring in 7 days" value={memberships.expiringSoon} tone={memberships.expiringSoon ? "warning" : "neutral"} />
        <StatCard label="Memberships expired" value={memberships.expired} tone={memberships.expired ? "danger" : "neutral"} />
      </div>

      <div className="mb-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Classes in the next 7 days</h2>
          <div className="grid grid-cols-2 gap-4">
            <StatCard label="Upcoming classes" value={classes.upcoming} />
            <StatCard
              label="Booking utilization"
              value={bookings.utilizationPercent === null ? null : `${bookings.utilizationPercent}%`}
              hint={bookings.utilizationPercent === null ? "No scheduled classes yet" : `${bookings.bookedSpots} of ${bookings.totalCapacity} spots booked`}
            />
          </div>
        </div>

        <div className="rounded-lg border border-border bg-surface p-4">
          <h2 className="mb-3 text-sm font-semibold text-text-primary">Training activity, last 30 days</h2>
          {trainingMax === 0 ? (
            <p className="text-sm text-text-muted">No attendance, workouts or PRs recorded in the last 30 days.</p>
          ) : (
            <>
              <BarRow label="Check-ins" value={training.attendanceLast30Days} max={trainingMax} />
              <BarRow label="Workouts logged" value={training.workoutsLast30Days} max={trainingMax} />
              <BarRow label="New PRs" value={training.newPrsLast30Days} max={trainingMax} />
            </>
          )}
        </div>
      </div>

      <h2 className="mb-2 text-sm font-semibold text-text-primary">Challenges</h2>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Active challenges" value={challenges.active} />
        <StatCard label="Participants" value={challenges.participants} />
      </div>
    </div>
  );
}
