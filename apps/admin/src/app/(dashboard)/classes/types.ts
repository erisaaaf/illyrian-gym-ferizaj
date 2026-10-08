export interface ClassListItem {
  id: string;
  title: string;
  description: string | null;
  startTime: string;
  endTime: string;
  capacity: number;
  bookedCount: number;
  status: "SCHEDULED" | "CANCELLED" | "COMPLETED";
  coach: { id: string; user: { firstName: string; lastName: string } } | null;
}

export interface PaginatedClasses {
  data: ClassListItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
