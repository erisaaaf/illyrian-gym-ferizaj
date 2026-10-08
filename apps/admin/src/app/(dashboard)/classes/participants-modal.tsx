"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState, DataEmptyState } from "../../../components/ui/states";
import { ClassListItem } from "./types";

interface Participant {
  id: string;
  status: string;
  bookedAt: string;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export function ParticipantsModal({ cls, onClose }: { cls: ClassListItem | null; onClose: () => void }) {
  const [participants, setParticipants] = useState<Participant[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!cls) return;
    setParticipants(null);
    setError(null);
    api
      .get<Participant[]>(`classes/${cls.id}/participants`)
      .then(setParticipants)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load participants."));
  }, [cls]);

  return (
    <Modal open={cls !== null} onClose={onClose} title={cls ? `Participants — ${cls.title}` : "Participants"}>
      {!participants && !error && <LoadingState label="Loading participants..." />}
      {error && <ErrorState message={error} />}
      {participants && participants.length === 0 && <DataEmptyState title="No bookings yet" message="Nobody has booked this class." />}
      {participants && participants.length > 0 && (
        <div className="flex flex-col gap-2">
          {participants.map((p) => (
            <div key={p.id} className="flex items-center justify-between rounded-md border border-border bg-surface-elevated px-3 py-2">
              <div>
                <p className="text-sm text-text-primary">
                  {p.user.firstName} {p.user.lastName}
                </p>
                <p className="text-xs text-text-muted">{p.user.email}</p>
              </div>
              <Badge variant={p.status === "BOOKED" || p.status === "ATTENDED" ? "success" : p.status === "WAITLISTED" ? "warning" : "neutral"}>
                {p.status.replace("_", " ")}
              </Badge>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
