import type { ExerciseCategory, ExerciseDifficulty, MeasurementType, PrType } from "../../generated/client";

// Generic, widely-known movement catalog used as starter reference data in
// development. It describes exercises, not people or gym policy, so it is
// safe to ship as seed data - authorized staff manage the real library from
// the admin dashboard (Exercises).
export interface ExerciseSeed {
  name: string;
  category: ExerciseCategory;
  measurementType: MeasurementType;
  prType: PrType | null;
  difficulty?: ExerciseDifficulty;
  equipment?: string[];
}

export const EXERCISES: ExerciseSeed[] = [
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
