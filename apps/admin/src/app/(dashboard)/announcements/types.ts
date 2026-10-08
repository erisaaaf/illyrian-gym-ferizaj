export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  imageUrl: string | null;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  publishAt: string | null;
  createdAt: string;
}

export interface PaginatedAnnouncements {
  data: AnnouncementItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}
