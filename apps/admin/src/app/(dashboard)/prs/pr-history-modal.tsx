"use client";

import { useEffect, useState } from "react";
import { api, ApiError } from "../../../lib/api";
import { Modal } from "../../../components/ui/modal";
import { Badge } from "../../../components/ui/badge";
import { LoadingState, ErrorState } from "../../../components/ui/states";
import { PrHistoryEntry, PrItem } from "./types";

export function PrHistoryModal({ pr, onClose }: { pr: PrItem | null; onClose: () => void }) {
  const [history, setHistory] = useState<PrHistoryEntry[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!pr) return;
    setHistory(null);
    setError(null);
    api
      .get<PrHistoryEntry[]>(`admin/prs/${pr.id}/history`)
      .then(setHistory)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Could not load history."));
  }, [pr]);

  return (
    <Modal open={pr !== null} onClose={onClose} title={pr ? `${pr.exercise.name} — History` : "PR History"}>
      {!history && !error && <LoadingState label="Loading history..." />}
      {error && <ErrorState message={error} />}
      {history && (
        <div className="flex flex-col gap-2">
          {history.map((h) => (
            <div key={h.id} className="rounded-md border border-border bg-surface-elevated px-3 py-2">
              <div className="flex items-center justify-between">
                <p className="text-sm text-text-primary">
                  {h.previousValue ? `${h.previousValue} → ` : ""}
                  <span className="font-medium">{h.newValue}</span> {h.unit.toLowerCase()}
                </p>
                <Badge variant={h.source === "CORRECTED" ? "warning" : h.source === "MANUAL" ? "info" : "success"}>
                  {h.source.replace("_", " ")}
                </Badge>
              </div>
              <p className="mt-0.5 text-xs text-text-muted">
                {new Date(h.achievedAt).toLocaleDateString()}
                {h.recordedBy ? ` · recorded by ${h.recordedBy.firstName} ${h.recordedBy.lastName}` : ""}
              </p>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
