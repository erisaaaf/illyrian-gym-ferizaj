export interface ChallengeItem {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  pointsLabel: string;
  startDate: string;
  endDate: string;
  status: "UPCOMING" | "ACTIVE" | "COMPLETED" | "CANCELLED";
  _count: { participants: number };
}

export interface PaginatedChallenges {
  data: ChallengeItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
