import { PrismaClient } from "../generated/client/index.js";

// Explicit /index.js (not a bare directory specifier) - Node's native
// TypeScript execution resolves extensionless directory imports under ESM
// rules and rejects them (ERR_UNSUPPORTED_DIR_IMPORT) even in a
// CommonJS-typed package.
export * from "../generated/client/index.js";

declare global {
  var __prismaClient: PrismaClient | undefined;
}

// A single shared PrismaClient instance per process. In dev, Nest's hot
// reload can otherwise spawn a new client (and connection pool) per reload;
// caching on `global` avoids exhausting Postgres connections.
export const prisma: PrismaClient =
  global.__prismaClient ??
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["warn", "error"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  global.__prismaClient = prisma;
}
