export interface WodExerciseItem {
  id?: string;
  exerciseId: string;
  order: number;
  sets?: number | null;
  reps?: number | null;
  weightKg?: number | null;
  durationSeconds?: number | null;
  restSeconds?: number | null;
  rounds?: number | null;
  timeCapSeconds?: number | null;
  instructions?: string | null;
  scalingNotes?: string | null;
  exercise?: { id: string; name: string };
}

export interface WodSectionItem {
  id?: string;
  type: "WARM_UP" | "STRENGTH" | "METCON" | "COOLDOWN";
  order: number;
  notes?: string | null;
  exercises: WodExerciseItem[];
}

export interface WodDetail {
  id: string;
  title: string;
  date: string;
  type: string;
  description: string | null;
  status: "DRAFT" | "PUBLISHED" | "ARCHIVED";
  sections: WodSectionItem[];
  createdBy: { id: string; firstName: string; lastName: string };
}

export interface PaginatedWods {
  data: WodDetail[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export const WOD_TYPES = ["AMRAP", "FOR_TIME", "EMOM", "TABATA", "STRENGTH", "CUSTOM"];
export const SECTION_TYPES: WodSectionItem["type"][] = ["WARM_UP", "STRENGTH", "METCON", "COOLDOWN"];
