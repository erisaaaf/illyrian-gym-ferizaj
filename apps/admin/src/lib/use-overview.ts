"use client";

import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "./api";

export interface Overview {
  generatedAt: string;
  members: { total: number; active: number };
  memberships: { expiringSoon: number; expired: number };
  classes: { upcoming: number };
  bookings: { utilizationPercent: number | null; bookedSpots: number; totalCapacity: number };
  training: { attendanceLast30Days: number; workoutsLast30Days: number; newPrsLast30Days: number };
  challenges: { active: number; participants: number };
  notifications: { unread: number };
}

export function useOverview() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setOverview(await api.get<Overview>("admin/analytics/overview"));
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Could not load analytics.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { overview, loading, error, reload: load };
}
