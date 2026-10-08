export interface MembershipPlan {
  id: string;
  name: string;
  description: string | null;
  durationDays: number;
  priceCents: number | null;
  currency: string;
  isActive: boolean;
}

export interface MembershipListItem {
  id: string;
  startDate: string;
  endDate: string;
  paymentStatus: "PAID" | "UNPAID" | "PARTIAL";
  computedStatus: "ACTIVE" | "EXPIRING_SOON" | "EXPIRED" | "CANCELLED";
  user: { id: string; firstName: string; lastName: string; email: string };
  plan: { id: string; name: string };
}

export interface PaginatedMemberships {
  data: MembershipListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
