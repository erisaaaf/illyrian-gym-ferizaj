export interface ExerciseItem {
  id: string;
  name: string;
  category: string;
  description: string | null;
  instructions: string | null;
  equipment: string[];
  difficulty: string;
  measurementType: string;
  prType: string | null;
  active: boolean;
}

export interface PaginatedExercises {
  data: ExerciseItem[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export const CATEGORIES = ["WEIGHTLIFTING", "GYMNASTICS", "CARDIO", "BODYWEIGHT", "STRONGMAN", "MOBILITY", "OTHER"];
export const DIFFICULTIES = ["BEGINNER", "INTERMEDIATE", "ADVANCED"];
export const MEASUREMENT_TYPES = ["WEIGHT", "REPS", "TIME", "DISTANCE", "ROUNDS"];
export const PR_TYPES = ["MAX_WEIGHT", "MAX_REPS", "FASTEST_TIME", "MAX_DISTANCE", "MAX_ROUNDS"];
