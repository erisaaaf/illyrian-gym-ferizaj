"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { ChallengeItem } from "./types";

interface LeaderboardEntry {
  id: string;
  points: number;
  user: { id: string; firstName: string; lastName: string };
}

export function LeaderboardModal({ challenge, onClose }: { challenge: ChallengeItem | null; onClose: () => void }) {
  const [entries, setEntries] = useState<LeaderboardEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!challenge) return;
    setEntries(null);
    setError(null);
    api
      .get<LeaderboardEntry[]>(`challenges/${challenge.id}/leaderboard`)
      .then(setEntries)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load the leaderboard."));
  }, [challenge]);

  return (
    <Modal open={challenge !== null} onClose={onClose} title={challenge ? `Leaderboard — ${challenge.title}` : "Leaderboard"}>
      {!entries && !error && <LoadingState label="Loading leaderboard..." />}
      {error && <ErrorState message={error} />}
      {entries && entries.length === 0 && <DataEmptyState title="No participants yet" message="Nobody has joined this challenge." />}
      {entries && entries.length > 0 && (
        <div className="flex flex-col gap-2">
          {entries.map((e, i) => (
            <div key={e.id} className="flex items-center justify-between rounded-md border border-border bg-surface-elevated px-3 py-2">
              <div className="flex items-center gap-3">
                <span className="w-5 text-sm font-semibold text-text-muted">{i + 1}</span>
                <span className="text-sm text-text-primary">
                  {e.user.firstName} {e.user.lastName}
                </span>
              </div>
              <span className="text-sm font-medium text-text-primary">
                {e.points} {challenge?.pointsLabel}
              </span>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
