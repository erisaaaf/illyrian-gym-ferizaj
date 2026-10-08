export interface CoachListItem {
  id: string;
  isActive: boolean;
  bio: string | null;
  specialties: string[];
  certifications: string[];
  user: { id: string; firstName: string; lastName: string; email: string; phone: string | null; status: string };
}

export interface PaginatedCoaches {
  data: CoachListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
