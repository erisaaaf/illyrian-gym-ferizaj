import * as bcrypt from "bcryptjs";
import { PrismaClient, Role } from "../generated/client";
import { EXERCISES } from "./seed-data/exercises";

// Development seed. It creates exactly one account - the Admin - so the
// admin dashboard is usable immediately. Trainers and members are NOT seeded:
// the Admin creates them from the dashboard (Coaches -> Add Trainer,
// Members -> Add Member), which is the real workflow. Optional fake demo
// people live in seed-demo.ts and are never required.
//
// Idempotent: every write is an upsert on a stable key, and the admin's
// password is only set on first creation, so re-running never duplicates rows
// or resets a password you changed.
const DEV_ADMIN_EMAIL = "admin@illyriangym.dev";
const DEV_ADMIN_PASSWORD = "DevPassword!123";

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === "production") {
    throw new Error("Refusing to run the development seed with NODE_ENV=production.");
  }

  const passwordHash = await bcrypt.hash(DEV_ADMIN_PASSWORD, 12);

  await prisma.user.upsert({
    where: { email: DEV_ADMIN_EMAIL },
    update: {},
    create: {
      email: DEV_ADMIN_EMAIL,
      passwordHash,
      firstName: "Admin",
      lastName: "Illyrian",
      role: Role.ADMIN,
      emailVerifiedAt: new Date(),
    },
  });

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

  console.log("Development seed complete.");
  console.log(`  Admin login: ${DEV_ADMIN_EMAIL} / ${DEV_ADMIN_PASSWORD}`);
  console.log(`  Exercise catalog: ${EXERCISES.length} exercises`);
  console.log("  No trainers or members are seeded - create them from the admin dashboard.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
