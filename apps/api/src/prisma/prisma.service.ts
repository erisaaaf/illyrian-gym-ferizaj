import { Injectable, OnModuleDestroy, OnModuleInit } from "@nestjs/common";
import { prisma, PrismaClient } from "@illyrian/database";

/**
 * Thin Nest wrapper around the shared PrismaClient singleton from
 * @illyrian/database, so the database connection lifecycle is tied to the
 * Nest application lifecycle (see main.ts enableShutdownHooks).
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly client: PrismaClient = prisma;

  async onModuleInit() {
    await this.client.$connect();
  }

  async onModuleDestroy() {
    await this.client.$disconnect();
  }
}
