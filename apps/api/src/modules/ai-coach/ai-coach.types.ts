export interface WodExerciseContext {
  name: string;
  sets: number | null;
  reps: number | null;
  weightKg: number | null;
  durationSeconds: number | null;
  rounds: number | null;
}

/** Everything the assistant is allowed to know about a member. All of it comes from the database. */
export interface CoachContext {
  member: { firstName: string };
  membership: { status: string; endDate: string | null; planName: string | null } | null;
  todaysWod: {
    title: string;
    type: string;
    sections: Array<{ type: string; notes: string | null; exercises: WodExerciseContext[] }>;
  } | null;
  personalRecords: Array<{ exercise: string; value: number; unit: string; achievedAt: string; verified: boolean }>;
  recentWorkouts: Array<{
    exercise: string | null;
    wod: string | null;
    completedAt: string;
    weightKg: number | null;
    reps: number | null;
    durationSeconds: number | null;
  }>;
  progress: {
    workoutsCompleted: number;
    classesAttended: number;
    prCount: number;
    currentStreakDays: number;
    trainingDaysLast30: number;
  };
  upcomingClasses: Array<{ title: string; startTime: string; status: string }>;
}

export interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

export interface CoachProvider {
  readonly name: "openai" | "local";
  reply(input: { message: string; history: ChatTurn[]; context: CoachContext }): Promise<string>;
}

export const COACH_DISCLAIMER =
  "I'm an AI assistant, not a medical professional. For pain, injury or health concerns please talk to a doctor or one of the gym's coaches.";
