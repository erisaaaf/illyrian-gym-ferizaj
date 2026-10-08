import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { UpdateGymSettingsDto } from "./dto/update-gym-settings.dto";

const SINGLETON_ID = "default";

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly config: ConfigService,
  ) {}

  /** Which optional integrations are actually configured - read from real env, never faked. */
  system() {
    const has = (key: string) => Boolean(this.config.get<string>(key));
    return {
      environment: this.config.get<string>("NODE_ENV"),
      integrations: {
        email: has("EMAIL_PROVIDER"),
        pushNotifications: has("FIREBASE_PROJECT_ID") && has("FIREBASE_CLIENT_EMAIL") && has("FIREBASE_PRIVATE_KEY"),
        aiCoach: has("OPENAI_API_KEY"),
        fileStorage: has("STORAGE_PROVIDER"),
      },
    };
  }

  async get() {
    const settings = await this.prisma.client.gymSettings.findUnique({ where: { id: SINGLETON_ID } });
    return (
      settings ?? {
        id: SINGLETON_ID,
        name: null,
        contactEmail: null,
        contactPhone: null,
        address: null,
        updatedAt: null,
        configured: false,
      }
    );
  }

  async update(dto: UpdateGymSettingsDto, actorId: string) {
    const settings = await this.prisma.client.gymSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...dto, updatedById: actorId },
      update: { ...dto, updatedById: actorId },
    });
    await this.audit.record({ actorId, action: "gym_settings.update", entityType: "GymSettings", entityId: SINGLETON_ID });
    return settings;
  }
}
