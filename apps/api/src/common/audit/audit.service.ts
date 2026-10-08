import { Injectable } from "@nestjs/common";
import { Prisma } from "@illyrian/database";
import { PrismaService } from "../../prisma/prisma.service";

export interface AuditEntry {
  actorId: string | null;
  action: string;
  entityType: string;
  entityId: string;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
}

/**
 * Central write path for AuditLog rows (see docs/database.md#audit-log and
 * spec section 47). Every sensitive action - role changes, PR corrections,
 * manual PR entry, membership changes, destructive admin actions - should
 * go through this rather than writing AuditLog directly, so the shape stays
 * consistent. Never pass credentials/tokens in `metadata`.
 */
@Injectable()
export class AuditService {
  constructor(private readonly prisma: PrismaService) {}

  async record(entry: AuditEntry): Promise<void> {
    await this.prisma.client.auditLog.create({
      data: {
        actorId: entry.actorId,
        action: entry.action,
        entityType: entry.entityType,
        entityId: entry.entityId,
        metadata: entry.metadata
          ? (JSON.parse(JSON.stringify(entry.metadata)) as Prisma.InputJsonValue)
          : undefined,
        ipAddress: entry.ipAddress,
      },
    });
  }
}
