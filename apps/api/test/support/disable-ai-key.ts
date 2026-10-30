// Import this FIRST in a spec that exercises the AI Coach: it guarantees the
// tests use the deterministic local assistant and never call a real AI vendor,
// even if a developer has OPENAI_API_KEY in their .env. (Must run before
// AppModule is imported, because ConfigModule reads the environment on import.)
process.env.OPENAI_API_KEY = "";
process.env.AI_RATE_LIMIT_PER_USER_PER_DAY = "12";
