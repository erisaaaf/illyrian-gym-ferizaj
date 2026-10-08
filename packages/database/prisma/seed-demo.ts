import * as bcrypt from "bcryptjs";
import {
  PrismaClient,
  Role,
  PrType,
  WodType,
  WodStatus,
  WodSectionType,
  ClassStatus,
  BookingStatus,
  AttendanceStatus,
} from "../generated/client";

const prisma = new PrismaClient();

// OPTIONAL demo data (npm run db:seed:demo). Nothing in the app depends on
// it - the Admin (base seed) creates real trainers and members from the
// dashboard. This only fills a dev database with fake people, classes, WODs
// and training history so lists, charts and the member/coach experience can be
// explored. Everything here is fake: not real Illyrian Gym staff, members,
// prices, or schedules. Run `npm run db:seed` first (it provides the exercise
// catalog). Idempotent: every write is an upsert on a stable email/name/id.
// NEVER run against production.
const DEV_PASSWORD = "DevPassword!123";

// Two named demo logins on a distinct `.local` domain so they read
// unambiguously as demo accounts (the bulk `@illyriangym.dev` people below
// only exist to make lists and tables look realistic).
const DEMO_TRAINER_EMAIL = "trainer@illyriangym.local";
const DEMO_MEMBER_EMAIL = "member@illyriangym.local";

async function hashPassword(plain: string) {
  return bcrypt.hash(plain, 10);
}

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the demo seed with NODE_ENV=production.");
  }
  console.log("Seeding optional demo data...");

  const passwordHash = await hashPassword(DEV_PASSWORD);
  const now = new Date();

  // --- Bulk generic coaches (realistic-looking list data, not the demo login) ---
  const coachSeeds = [
    { firstName: "Arben", lastName: "Krasniqi", bio: "Head coach, 8 years of CrossFit coaching experience.", specialties: ["Weightlifting", "Programming"] },
    { firstName: "Elira", lastName: "Gashi", bio: "Gymnastics and mobility specialist.", specialties: ["Gymnastics", "Mobility"] },
    { firstName: "Dardan", lastName: "Berisha", bio: "Strength & conditioning coach.", specialties: ["Powerlifting", "Conditioning"] },
  ];

  const coaches = [];
  for (const c of coachSeeds) {
    const email = `${c.firstName.toLowerCase()}.${c.lastName.toLowerCase()}@illyriangym.dev`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, firstName: c.firstName, lastName: c.lastName, role: Role.COACH, emailVerifiedAt: new Date() },
    });
    const coach = await prisma.coach.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, bio: c.bio, specialties: c.specialties, certifications: ["CrossFit Level 1"] },
    });
    coaches.push(coach);
  }

  // --- Demo Trainer (spec section 5) ---
  const demoTrainerUser = await prisma.user.upsert({
    where: { email: DEMO_TRAINER_EMAIL },
    update: {},
    create: {
      email: DEMO_TRAINER_EMAIL,
      passwordHash,
      firstName: "Demo",
      lastName: "Trainer",
      role: Role.COACH,
      emailVerifiedAt: new Date(),
    },
  });
  const demoCoach = await prisma.coach.upsert({
    where: { userId: demoTrainerUser.id },
    update: {},
    create: {
      userId: demoTrainerUser.id,
      bio: "Demo/development coach account for testing the coach experience end-to-end. Not a real Illyrian Gym staff member.",
      specialties: ["General Fitness"],
      certifications: ["Demo Certification"],
    },
  });

  // --- Bulk generic members (realistic-looking list data, not the demo login) ---
  const memberFirstNames = ["Blerim", "Fatmire", "Genc", "Hana", "Ilir", "Jeta", "Kushtrim", "Lira", "Mirsad", "Nita", "Orges", "Petrit"];
  const members = [];
  for (let i = 0; i < memberFirstNames.length; i++) {
    const email = `${memberFirstNames[i].toLowerCase()}.member${i}@illyriangym.dev`;
    const user = await prisma.user.upsert({
      where: { email },
      update: {},
      create: { email, passwordHash, firstName: memberFirstNames[i], lastName: "Ferizaj", role: Role.MEMBER, emailVerifiedAt: new Date() },
    });
    members.push(user);
  }

  // --- Demo Member (spec section 5) ---
  const demoMemberUser = await prisma.user.upsert({
    where: { email: DEMO_MEMBER_EMAIL },
    update: {},
    create: {
      email: DEMO_MEMBER_EMAIL,
      passwordHash,
      firstName: "Demo",
      lastName: "Member",
      role: Role.MEMBER,
      emailVerifiedAt: new Date(),
    },
  });

  // --- Membership plans + memberships ---
  const monthlyPlan = await prisma.membershipPlan.upsert({
    where: { id: "seed-plan-monthly" },
    update: {},
    create: { id: "seed-plan-monthly", name: "Monthly Unlimited", durationDays: 30, isActive: true },
  });

  const in25Days = new Date(now.getTime() + 25 * 86400000);
  const past5Days = new Date(now.getTime() - 5 * 86400000);
  const past1Day = new Date(now.getTime() - 1 * 86400000);

  for (const [i, member] of members.entries()) {
    await prisma.membership.upsert({
      where: { id: `seed-membership-${i}` },
      update: {},
      create: {
        id: `seed-membership-${i}`,
        userId: member.id,
        planId: monthlyPlan.id,
        startDate: i % 5 === 0 ? past5Days : now,
        endDate: i % 5 === 0 ? past1Day : in25Days,
        paymentStatus: "PAID",
      },
    });
  }

  await prisma.membership.upsert({
    where: { id: "seed-membership-demo-member" },
    update: {},
    create: {
      id: "seed-membership-demo-member",
      userId: demoMemberUser.id,
      planId: monthlyPlan.id,
      startDate: past5Days,
      endDate: in25Days,
      paymentStatus: "PAID",
    },
  });

  // Exercises come from the base seed (npm run db:seed) - fail fast with a clear message if it hasn't run.
  if ((await prisma.exercise.count()) === 0) {
    throw new Error("Exercise catalog is empty. Run `npm run db:seed` before `npm run db:seed:demo`.");
  }
  const exercise = (name: string) => prisma.exercise.findUniqueOrThrow({ where: { name } });

  // --- Classes: upcoming (bookable) ---
  const upcomingClasses = [];
  for (let d = 0; d < 5; d++) {
    const start = new Date(now.getTime() + d * 86400000);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    const coachForClass = d === 0 ? demoCoach : coaches[d % coaches.length];
    const cls = await prisma.class.upsert({
      where: { id: `seed-class-${d}` },
      update: { bookedCount: d === 0 ? 1 : 0 },
      create: {
        id: `seed-class-${d}`,
        title: "CrossFit Group Class",
        coachId: coachForClass.id,
        startTime: start,
        endTime: end,
        capacity: 15,
        bookedCount: d === 0 ? 1 : 0,
        status: ClassStatus.SCHEDULED,
      },
    });
    upcomingClasses.push(cls);
  }

  // --- Classes: past (for attendance history), assigned to the demo trainer ---
  const pastClasses = [];
  for (let d = 1; d <= 2; d++) {
    const start = new Date(now.getTime() - d * 86400000);
    start.setHours(18, 0, 0, 0);
    const end = new Date(start.getTime() + 60 * 60000);
    const cls = await prisma.class.upsert({
      where: { id: `seed-class-past-${d}` },
      update: {},
      create: {
        id: `seed-class-past-${d}`,
        title: "CrossFit Group Class",
        coachId: demoCoach.id,
        startTime: start,
        endTime: end,
        capacity: 15,
        bookedCount: 1,
        status: ClassStatus.COMPLETED,
      },
    });
    pastClasses.push(cls);
  }

  // --- Demo member: upcoming booking on the demo trainer's class (seed-class-0) ---
  await prisma.booking.upsert({
    where: { id: "seed-booking-demo-upcoming" },
    update: {},
    create: {
      id: "seed-booking-demo-upcoming",
      userId: demoMemberUser.id,
      classId: upcomingClasses[0].id,
      status: BookingStatus.BOOKED,
    },
  });

  // --- Demo member: past booking + attendance (checked in) ---
  const pastBooking = await prisma.booking.upsert({
    where: { id: "seed-booking-demo-past" },
    update: {},
    create: {
      id: "seed-booking-demo-past",
      userId: demoMemberUser.id,
      classId: pastClasses[0].id,
      status: BookingStatus.ATTENDED,
      bookedAt: pastClasses[0].startTime,
    },
  });
  await prisma.attendance.upsert({
    where: { userId_classId: { userId: demoMemberUser.id, classId: pastClasses[0].id } },
    update: {},
    create: {
      userId: demoMemberUser.id,
      classId: pastClasses[0].id,
      bookingId: pastBooking.id,
      status: AttendanceStatus.CHECKED_IN,
      checkedInAt: pastClasses[0].startTime,
    },
  });

  // --- Today's WOD (created by the demo trainer so "coach's WODs" has data) ---
  const backSquat = await exercise("Back Squat");
  const wallBall = await exercise("Wall Ball");
  const rowExercise = await exercise("Row (500m)");

  const todayWod = await prisma.wod.upsert({
    where: { id: "seed-wod-today" },
    update: {},
    create: {
      id: "seed-wod-today",
      title: "Illyrian Strength & Metcon",
      date: new Date(new Date().toDateString()),
      type: WodType.AMRAP,
      status: WodStatus.PUBLISHED,
      createdById: demoTrainerUser.id,
      sections: {
        create: [
          {
            type: WodSectionType.STRENGTH,
            order: 1,
            notes: "Build to a heavy 5-rep set.",
            exercises: { create: [{ exerciseId: backSquat.id, order: 1, sets: 5, reps: 5 }] },
          },
          {
            type: WodSectionType.METCON,
            order: 2,
            notes: "AMRAP 15 minutes",
            exercises: {
              create: [
                { exerciseId: wallBall.id, order: 1, reps: 15 },
                { exerciseId: rowExercise.id, order: 2, rounds: 1 },
              ],
            },
          },
        ],
      },
    },
  });

  // A second, draft WOD for the trainer to test publish/unpublish with.
  await prisma.wod.upsert({
    where: { id: "seed-wod-draft" },
    update: {},
    create: {
      id: "seed-wod-draft",
      title: "Tomorrow's Gymnastics Skill Work",
      date: new Date(now.getTime() + 86400000),
      type: WodType.EMOM,
      status: WodStatus.DRAFT,
      createdById: demoTrainerUser.id,
      sections: {
        create: [
          {
            type: WodSectionType.STRENGTH,
            order: 1,
            notes: "EMOM 10: even minutes pull-ups, odd minutes push-ups",
            exercises: {
              create: [
                { exerciseId: (await exercise("Pull-up")).id, order: 1, reps: 8 },
                { exerciseId: (await exercise("Push-up")).id, order: 2, reps: 12 },
              ],
            },
          },
        ],
      },
    },
  });

  // --- Demo member: several workout results, including two exercises with a PR + history progression ---
  const workoutSeeds: Array<{
    id: string;
    exerciseName: string;
    daysAgo: number;
    weightKg?: number;
    durationSeconds?: number;
    reps?: number;
  }> = [
    { id: "seed-workout-demo-1", exerciseName: "Back Squat", daysAgo: 14, weightKg: 80 },
    { id: "seed-workout-demo-2", exerciseName: "Back Squat", daysAgo: 3, weightKg: 90 },
    { id: "seed-workout-demo-3", exerciseName: "Row (500m)", daysAgo: 10, durationSeconds: 130 },
    { id: "seed-workout-demo-4", exerciseName: "Row (500m)", daysAgo: 2, durationSeconds: 122 },
    { id: "seed-workout-demo-5", exerciseName: "Pull-up", daysAgo: 7, reps: 8 },
  ];

  for (const w of workoutSeeds) {
    const ex = await exercise(w.exerciseName);
    await prisma.workoutResult.upsert({
      where: { id: w.id },
      update: {},
      create: {
        id: w.id,
        userId: demoMemberUser.id,
        exerciseId: ex.id,
        weightKg: w.weightKg,
        durationSeconds: w.durationSeconds,
        reps: w.reps,
        completedAt: new Date(now.getTime() - w.daysAgo * 86400000),
      },
    });
  }

  // PersonalRecord + PersonalRecordHistory rows, hand-built to mirror
  // exactly what PrsService.applyWorkoutResult would have produced for the
  // workout results above (the seed script runs standalone, outside Nest's
  // DI container, so it can't call the real service - see docs/pr-engine
  // notes in prs.service.ts for the authoritative logic this mirrors).
  const backSquatPr = await prisma.personalRecord.upsert({
    where: { userId_exerciseId: { userId: demoMemberUser.id, exerciseId: backSquat.id } },
    update: { value: 90, sourceWorkoutId: "seed-workout-demo-2", achievedAt: new Date(now.getTime() - 3 * 86400000) },
    create: {
      userId: demoMemberUser.id,
      exerciseId: backSquat.id,
      recordType: PrType.MAX_WEIGHT,
      value: 90,
      unit: "KG",
      achievedAt: new Date(now.getTime() - 3 * 86400000),
      sourceWorkoutId: "seed-workout-demo-2",
      verificationStatus: "UNVERIFIED",
    },
  });
  await prisma.personalRecordHistory.upsert({
    where: { id: "seed-pr-history-backsquat-1" },
    update: {},
    create: {
      id: "seed-pr-history-backsquat-1",
      personalRecordId: backSquatPr.id,
      userId: demoMemberUser.id,
      exerciseId: backSquat.id,
      previousValue: null,
      newValue: 80,
      unit: "KG",
      achievedAt: new Date(now.getTime() - 14 * 86400000),
      sourceWorkoutId: "seed-workout-demo-1",
      source: "AUTO_DETECTED",
    },
  });
  await prisma.personalRecordHistory.upsert({
    where: { id: "seed-pr-history-backsquat-2" },
    update: {},
    create: {
      id: "seed-pr-history-backsquat-2",
      personalRecordId: backSquatPr.id,
      userId: demoMemberUser.id,
      exerciseId: backSquat.id,
      previousValue: 80,
      newValue: 90,
      unit: "KG",
      achievedAt: new Date(now.getTime() - 3 * 86400000),
      sourceWorkoutId: "seed-workout-demo-2",
      source: "AUTO_DETECTED",
    },
  });

  const rowPr = await prisma.personalRecord.upsert({
    where: { userId_exerciseId: { userId: demoMemberUser.id, exerciseId: rowExercise.id } },
    update: { value: 122, sourceWorkoutId: "seed-workout-demo-4", achievedAt: new Date(now.getTime() - 2 * 86400000) },
    create: {
      userId: demoMemberUser.id,
      exerciseId: rowExercise.id,
      recordType: PrType.FASTEST_TIME,
      value: 122,
      unit: "SECONDS",
      achievedAt: new Date(now.getTime() - 2 * 86400000),
      sourceWorkoutId: "seed-workout-demo-4",
      verificationStatus: "VERIFIED",
      verifiedById: demoTrainerUser.id,
      verifiedAt: now,
    },
  });
  await prisma.personalRecordHistory.upsert({
    where: { id: "seed-pr-history-row-1" },
    update: {},
    create: {
      id: "seed-pr-history-row-1",
      personalRecordId: rowPr.id,
      userId: demoMemberUser.id,
      exerciseId: rowExercise.id,
      previousValue: null,
      newValue: 130,
      unit: "SECONDS",
      achievedAt: new Date(now.getTime() - 10 * 86400000),
      sourceWorkoutId: "seed-workout-demo-3",
      source: "AUTO_DETECTED",
    },
  });
  await prisma.personalRecordHistory.upsert({
    where: { id: "seed-pr-history-row-2" },
    update: {},
    create: {
      id: "seed-pr-history-row-2",
      personalRecordId: rowPr.id,
      userId: demoMemberUser.id,
      exerciseId: rowExercise.id,
      previousValue: 130,
      newValue: 122,
      unit: "SECONDS",
      achievedAt: new Date(now.getTime() - 2 * 86400000),
      sourceWorkoutId: "seed-workout-demo-4",
      source: "AUTO_DETECTED",
    },
  });

  // --- Demo member: achievement ---
  const firstWorkoutAchievement = await prisma.achievement.upsert({
    where: { key: "first_workout" },
    update: {},
    create: {
      key: "first_workout",
      title: "First Workout",
      description: "Recorded your first workout result.",
      criteria: { type: "workout_count", threshold: 1 },
    },
  });
  await prisma.userAchievement.upsert({
    where: { userId_achievementId: { userId: demoMemberUser.id, achievementId: firstWorkoutAchievement.id } },
    update: {},
    create: { userId: demoMemberUser.id, achievementId: firstWorkoutAchievement.id, earnedAt: new Date(now.getTime() - 14 * 86400000) },
  });

  console.log("");
  console.log("Demo seed complete.");
  console.log(`  Demo Trainer: ${DEMO_TRAINER_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`  Demo Member:  ${DEMO_MEMBER_EMAIL} / ${DEV_PASSWORD}`);
  console.log(`  (bulk generic coaches/members share the same demo password)`);
  console.log(`Today's WOD seeded: ${todayWod.title}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
