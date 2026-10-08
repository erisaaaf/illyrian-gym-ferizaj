import { Controller, Get, ServiceUnavailableException } from "@nestjs/common";
import { Public } from "../../common/decorators/public.decorator";
import { PrismaService } from "../../prisma/prisma.service";

@Controller("health")
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  @Public()
  @Get()
  liveness() {
    return { status: "ok", timestamp: new Date().toISOString() };
  }

  @Public()
  @Get("ready")
  async readiness() {
    try {
      await this.prisma.client.$queryRaw`SELECT 1`;
      return { status: "ok", database: "up", timestamp: new Date().toISOString() };
    } catch {
      throw new ServiceUnavailableException("Database is not reachable");
    }
  }
}
