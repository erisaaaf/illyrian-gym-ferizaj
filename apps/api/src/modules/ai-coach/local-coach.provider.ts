import { ChatTurn, CoachContext, CoachProvider, COACH_DISCLAIMER, WodExerciseContext } from "./ai-coach.types";

const HEALTH = /\b(pain|hurt|injur|injury|dizzy|chest|faint|sick|pregnan|medicat|surgery|diagnos|doctor)\w*/i;

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
const fmtTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

function describeExercise(e: WodExerciseContext) {
  const bits: string[] = [];
  if (e.sets && e.reps) bits.push(`${e.sets}x${e.reps}`);
  else if (e.reps) bits.push(`${e.reps} reps`);
  if (e.weightKg) bits.push(`${e.weightKg} kg`);
  if (e.durationSeconds) bits.push(fmtTime(e.durationSeconds));
  if (e.rounds) bits.push(`${e.rounds} rounds`);
  return bits.length ? `${e.name} (${bits.join(", ")})` : e.name;
}

/**
 * Used when no AI provider key is configured. It is NOT a language model: it
 * recognises a handful of intents and answers them straight from the member's
 * own stored data. It never invents facts and says so when it has nothing.
 */
export class LocalCoachProvider implements CoachProvider {
  readonly name = "local" as const;

  async reply({ message, context }: { message: string; history: ChatTurn[]; context: CoachContext }): Promise<string> {
    const m = message.toLowerCase();

    if (HEALTH.test(m)) {
      return `${COACH_DISCLAIMER} I can't assess pain or injuries - please stop if something hurts and ask a coach to look at it.`;
    }

    if (/\b(wod|workout of the day|today)\b/.test(m)) {
      const wod = context.todaysWod;
      if (!wod) return "There is no published WOD for today yet. Check back later or ask your coach.";
      const lines = wod.sections.map(
        (s) => `${s.type.replace("_", " ")}: ${s.exercises.map(describeExercise).join(", ") || "see coach"}${s.notes ? ` - ${s.notes}` : ""}`,
      );
      return `Today's WOD is "${wod.title}" (${wod.type.replace("_", " ")}).\n${lines.join("\n")}`;
    }

    if (/\b(pr|prs|record|records|personal best|max|heaviest|fastest)\b/.test(m)) {
      if (context.personalRecords.length === 0) {
        return "You don't have any personal records yet. Log a workout with a weight, reps or time and I'll track your PRs automatically.";
      }
      const lines = context.personalRecords
        .slice(0, 6)
        .map(
          (p) =>
            `${p.exercise}: ${p.unit === "SECONDS" ? fmtTime(p.value) : `${p.value} ${p.unit.toLowerCase()}`} (${fmtDate(p.achievedAt)}${p.verified ? ", verified" : ""})`,
        );
      return `Your personal records:\n${lines.join("\n")}`;
    }

    if (/\b(progress|streak|stats|consisten\w*|frequency|how am i|how many)\b/.test(m)) {
      const p = context.progress;
      if (p.workoutsCompleted === 0 && p.classesAttended === 0) {
        return "I don't have any training logged for you yet. Log a workout or attend a class and I can show your progress.";
      }
      return `So far you've logged ${p.workoutsCompleted} workouts, attended ${p.classesAttended} classes and set ${p.prCount} PRs. You trained on ${p.trainingDaysLast30} of the last 30 days and your current streak is ${p.currentStreakDays} day${p.currentStreakDays === 1 ? "" : "s"}.`;
    }

    if (/\b(class|classes|book|booking|schedule|next session)\b/.test(m)) {
      if (context.upcomingClasses.length === 0) return "You have no upcoming bookings. Open the Schedule tab to book a class.";
      const lines = context.upcomingClasses.map(
        (c) =>
          `${c.title} - ${new Date(c.startTime).toLocaleString("en-GB", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })} (${c.status.toLowerCase()})`,
      );
      return `Your upcoming classes:\n${lines.join("\n")}`;
    }

    if (/\b(membership|expire|expiry|subscription|plan)\b/.test(m)) {
      const ms = context.membership;
      if (!ms) return "I can't see a membership on your account. Please ask the front desk.";
      return `Your membership is ${ms.status.toLowerCase().replace("_", " ")}${ms.planName ? ` on the ${ms.planName} plan` : ""}${ms.endDate ? ` and runs until ${fmtDate(ms.endDate)}` : ""}.`;
    }

    if (/\b(recent|last workout|history|lately)\b/.test(m)) {
      if (context.recentWorkouts.length === 0) return "No workouts logged yet.";
      const lines = context.recentWorkouts.map(
        (w) =>
          `${fmtDate(w.completedAt)}: ${w.exercise ?? w.wod ?? "Workout"}${w.weightKg ? ` ${w.weightKg} kg` : ""}${w.reps ? ` x ${w.reps}` : ""}${w.durationSeconds ? ` ${fmtTime(w.durationSeconds)}` : ""}`,
      );
      return `Your latest workouts:\n${lines.join("\n")}`;
    }

    return `Hi ${context.member.firstName}! I'm running in basic mode (no AI model is connected), so I can answer questions about today's WOD, your PRs, your progress and streak, your upcoming classes and your membership. What would you like to know?`;
  }
}
