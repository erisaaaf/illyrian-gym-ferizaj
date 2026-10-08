export interface PrItem {
  id: string;
  value: string;
  unit: string;
  achievedAt: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED";
  user: { id: string; firstName: string; lastName: string };
  exercise: { id: string; name: string; category: string; prType: string | null };
}

export interface PaginatedPrs {
  data: PrItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface PrHistoryEntry {
  id: string;
  previousValue: string | null;
  newValue: string;
  unit: string;
  achievedAt: string;
  source: "AUTO_DETECTED" | "MANUAL" | "CORRECTED";
  recordedBy: { id: string; firstName: string; lastName: string } | null;
}
