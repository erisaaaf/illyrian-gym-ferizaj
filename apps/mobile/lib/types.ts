export interface Paginated<T> {
  data: T[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
}

export interface ClassItem {
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

export type BookingStatus = "BOOKED" | "WAITLISTED" | "CANCELLED" | "ATTENDED" | "NO_SHOW";

export interface BookingItem {
  id: string;
  status: BookingStatus;
  class: { id: string; title: string; startTime: string; endTime: string };
}

export interface Participant {
  id: string;
  status: BookingStatus;
  user: { id: string; firstName: string; lastName: string; email: string };
}

export type MeasurementType = "WEIGHT" | "REPS" | "TIME" | "DISTANCE" | "ROUNDS";

export interface WodExercise {
  id: string;
  order: number;
  sets: number | null;
  reps: number | null;
  weightKg: string | null;
  durationSeconds: number | null;
  rounds: number | null;
  timeCapSeconds: number | null;
  instructions: string | null;
  scalingNotes: string | null;
  exercise: { id: string; name: string; category: string; measurementType: MeasurementType };
}

export interface Wod {
  id: string;
  title: string;
  type: string;
  description: string | null;
  date: string;
  status: string;
  sections: Array<{ id: string; type: string; order: number; notes: string | null; exercises: WodExercise[] }>;
}

export interface PersonalRecord {
  id: string;
  exerciseId: string;
  value: string;
  unit: string;
  achievedAt: string;
  verificationStatus: "UNVERIFIED" | "VERIFIED";
  exercise: { id: string; name: string };
}

export interface PrHistoryEntry {
  id: string;
  previousValue: string | null;
  newValue: string;
  unit: string;
  achievedAt: string;
  source: string;
}

export interface WorkoutResultItem {
  id: string;
  completedAt: string;
  weightKg: string | null;
  reps: number | null;
  durationSeconds: number | null;
  rounds: number | null;
  distanceMeters: string | null;
  wod: { id: string; title: string } | null;
  exercise: { id: string; name: string } | null;
}

export interface WorkoutRecordResponse {
  workoutResult: { id: string };
  prOutcome: { isNewPr: boolean; previousValue: string | number | null; personalRecord: { value: string; unit: string } | null } | null;
}

export interface ProgressSummary {
  workoutsCompleted: number;
  classesAttended: number;
  prCount: number;
  currentStreakDays: number;
  trainingDaysLast30: number;
  weeklyTrainingDays: Array<{ weeksAgo: number; trainingDays: number }>;
}

export interface AnnouncementItem {
  id: string;
  title: string;
  content: string;
  priority: "NORMAL" | "IMPORTANT" | "URGENT";
  createdAt: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
}

export interface CoachMessage {
  id: string;
  role: "USER" | "ASSISTANT";
  content: string;
  createdAt: string;
}
