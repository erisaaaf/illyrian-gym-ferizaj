"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const bcrypt = __importStar(require("bcryptjs"));
const client_1 = require("../generated/client");
const prisma = new client_1.PrismaClient();
// Development-only seed data. NEVER run against a production database -
// these are fake accounts/passwords for local development and demos only.
const DEV_PASSWORD = "DevPassword!123";
async function hashPassword(plain) {
    return bcrypt.hash(plain, 10);
}
const EXERCISES = [
    { name: "Back Squat", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell", "Rack"] },
    { name: "Front Squat", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell", "Rack"] },
    { name: "Overhead Squat", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Deadlift", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Sumo Deadlift", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Clean", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"], difficulty: "ADVANCED" },
    { name: "Power Clean", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"], difficulty: "ADVANCED" },
    { name: "Clean and Jerk", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"], difficulty: "ADVANCED" },
    { name: "Snatch", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"], difficulty: "ADVANCED" },
    { name: "Power Snatch", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"], difficulty: "ADVANCED" },
    { name: "Push Press", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Push Jerk", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Strict Press", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Bench Press", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell", "Bench"] },
    { name: "Thruster", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Barbell"] },
    { name: "Pull-up", category: "GYMNASTICS", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Pull-up Bar"] },
    { name: "Chest-to-Bar Pull-up", category: "GYMNASTICS", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Pull-up Bar"], difficulty: "ADVANCED" },
    { name: "Muscle-up", category: "GYMNASTICS", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Rings", "Pull-up Bar"], difficulty: "ADVANCED" },
    { name: "Handstand Push-up", category: "GYMNASTICS", measurementType: "REPS", prType: "MAX_REPS", difficulty: "ADVANCED" },
    { name: "Toes-to-Bar", category: "GYMNASTICS", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Pull-up Bar"] },
    { name: "Push-up", category: "BODYWEIGHT", measurementType: "REPS", prType: "MAX_REPS" },
    { name: "Air Squat", category: "BODYWEIGHT", measurementType: "REPS", prType: "MAX_REPS" },
    { name: "Burpee", category: "BODYWEIGHT", measurementType: "REPS", prType: "MAX_REPS" },
    { name: "Box Jump", category: "BODYWEIGHT", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Box"] },
    { name: "Wall Ball", category: "BODYWEIGHT", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Medicine Ball"] },
    { name: "Kettlebell Swing", category: "WEIGHTLIFTING", measurementType: "WEIGHT", prType: "MAX_WEIGHT", equipment: ["Kettlebell"] },
    { name: "Double Under", category: "CARDIO", measurementType: "REPS", prType: "MAX_REPS", equipment: ["Jump Rope"] },
    { name: "Row (500m)", category: "CARDIO", measurementType: "TIME", prType: "FASTEST_TIME", equipment: ["Rower"] },
    { name: "Run (1 mile)", category: "CARDIO", measurementType: "TIME", prType: "FASTEST_TIME" },
    { name: "Run (5k)", category: "CARDIO", measurementType: "TIME", prType: "FASTEST_TIME" },
    { name: "Assault Bike (Calories)", category: "CARDIO", measurementType: "DISTANCE", prType: "MAX_DISTANCE", equipment: ["Assault Bike"] },
    { name: "Farmers Carry", category: "STRONGMAN", measurementType: "DISTANCE", prType: "MAX_DISTANCE", equipment: ["Kettlebells", "Dumbbells"] },
    { name: "Sled Push", category: "STRONGMAN", measurementType: "DISTANCE", prType: "MAX_DISTANCE", equipment: ["Sled"] },
    { name: "Plank Hold", category: "BODYWEIGHT", measurementType: "TIME", prType: "FASTEST_TIME" },
    { name: "AMRAP 12min Benchmark", category: "OTHER", measurementType: "ROUNDS", prType: "MAX_ROUNDS" },
];
async function main() {
    console.log("Seeding development database...");
    const passwordHash = await hashPassword(DEV_PASSWORD);
    // --- Admin ---
    const admin = await prisma.user.upsert({
        where: { email: "admin@illyriangym.dev" },
        update: {},
        create: {
            email: "admin@illyriangym.dev",
            passwordHash,
            firstName: "Admin",
            lastName: "Illyrian",
            role: client_1.Role.ADMIN,
            emailVerifiedAt: new Date(),
        },
    });
    // --- Coaches ---
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
            create: {
                email,
                passwordHash,
                firstName: c.firstName,
                lastName: c.lastName,
                role: client_1.Role.COACH,
                emailVerifiedAt: new Date(),
            },
        });
        const coach = await prisma.coach.upsert({
            where: { userId: user.id },
            update: {},
            create: {
                userId: user.id,
                bio: c.bio,
                specialties: c.specialties,
                certifications: ["CrossFit Level 1"],
            },
        });
        coaches.push(coach);
    }
    // --- Members ---
    const memberFirstNames = ["Blerim", "Fatmire", "Genc", "Hana", "Ilir", "Jeta", "Kushtrim", "Lira", "Mirsad", "Nita", "Orges", "Petrit"];
    const members = [];
    for (let i = 0; i < memberFirstNames.length; i++) {
        const email = `${memberFirstNames[i].toLowerCase()}.member${i}@illyriangym.dev`;
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: {
                email,
                passwordHash,
                firstName: memberFirstNames[i],
                lastName: "Ferizaj",
                role: client_1.Role.MEMBER,
                emailVerifiedAt: new Date(),
            },
        });
        members.push(user);
    }
    // --- Membership plans + memberships ---
    const monthlyPlan = await prisma.membershipPlan.upsert({
        where: { id: "seed-plan-monthly" },
        update: {},
        create: { id: "seed-plan-monthly", name: "Monthly Unlimited", durationDays: 30, isActive: true },
    });
    const now = new Date();
    const in25Days = new Date(now.getTime() + 25 * 86400000);
    const past = new Date(now.getTime() - 5 * 86400000);
    for (const [i, member] of members.entries()) {
        await prisma.membership.upsert({
            where: { id: `seed-membership-${i}` },
            update: {},
            create: {
                id: `seed-membership-${i}`,
                userId: member.id,
                planId: monthlyPlan.id,
                startDate: i % 5 === 0 ? past : now,
                endDate: i % 5 === 0 ? new Date(now.getTime() - 1 * 86400000) : in25Days,
                paymentStatus: "PAID",
            },
        });
    }
    // --- Exercises ---
    for (const ex of EXERCISES) {
        await prisma.exercise.upsert({
            where: { name: ex.name },
            update: {},
            create: {
                name: ex.name,
                category: ex.category,
                measurementType: ex.measurementType,
                prType: ex.prType ?? undefined,
                difficulty: ex.difficulty ?? "INTERMEDIATE",
                equipment: ex.equipment ?? [],
            },
        });
    }
    // --- Classes ---
    for (let d = 0; d < 5; d++) {
        const start = new Date(now.getTime() + d * 86400000);
        start.setHours(18, 0, 0, 0);
        const end = new Date(start.getTime() + 60 * 60000);
        await prisma.class.upsert({
            where: { id: `seed-class-${d}` },
            update: {},
            create: {
                id: `seed-class-${d}`,
                title: "CrossFit Group Class",
                coachId: coaches[d % coaches.length].id,
                startTime: start,
                endTime: end,
                capacity: 15,
                status: client_1.ClassStatus.SCHEDULED,
            },
        });
    }
    // --- Today's WOD ---
    const backSquat = await prisma.exercise.findUnique({ where: { name: "Back Squat" } });
    const wallBall = await prisma.exercise.findUnique({ where: { name: "Wall Ball" } });
    const rowExercise = await prisma.exercise.findUnique({ where: { name: "Row (500m)" } });
    const todayWod = await prisma.wod.upsert({
        where: { id: "seed-wod-today" },
        update: {},
        create: {
            id: "seed-wod-today",
            title: "Illyrian Strength & Metcon",
            date: new Date(new Date().toDateString()),
            type: client_1.WodType.AMRAP,
            status: client_1.WodStatus.PUBLISHED,
            createdById: admin.id,
            sections: {
                create: [
                    {
                        type: client_1.WodSectionType.STRENGTH,
                        order: 1,
                        notes: "Build to a heavy 5-rep set.",
                        exercises: backSquat
                            ? { create: [{ exerciseId: backSquat.id, order: 1, sets: 5, reps: 5 }] }
                            : undefined,
                    },
                    {
                        type: client_1.WodSectionType.METCON,
                        order: 2,
                        notes: "AMRAP 15 minutes",
                        exercises: {
                            create: [
                                ...(wallBall ? [{ exerciseId: wallBall.id, order: 1, reps: 15 }] : []),
                                ...(rowExercise ? [{ exerciseId: rowExercise.id, order: 2, rounds: 1 }] : []),
                            ],
                        },
                    },
                ],
            },
        },
    });
    console.log(`Seed complete. Admin: admin@illyriangym.dev / ${DEV_PASSWORD}`);
    console.log(`Coaches and members share the same dev password: ${DEV_PASSWORD}`);
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
