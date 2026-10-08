import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";
import { CoachesModule } from "./modules/coaches/coaches.module";
import { AdminMembersModule } from "./modules/admin-members/admin-members.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { ClassesModule } from "./modules/classes/classes.module";
import { BookingsModule } from "./modules/bookings/bookings.module";
import { ExercisesModule } from "./modules/exercises/exercises.module";
import { WodsModule } from "./modules/wods/wods.module";
import { WorkoutsModule } from "./modules/workouts/workouts.module";
import { PrsModule } from "./modules/prs/prs.module";
import { AttendanceModule } from "./modules/attendance/attendance.module";
import { ChallengesModule } from "./modules/challenges/challenges.module";
import { AnnouncementsModule } from "./modules/announcements/announcements.module";
import { NotificationsModule } from "./modules/notifications/notifications.module";
import { AnalyticsModule } from "./modules/analytics/analytics.module";
import { SettingsModule } from "./modules/settings/settings.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>("RATE_LIMIT_TTL_SECONDS")! * 1000,
            limit: config.get<number>("RATE_LIMIT_MAX_REQUESTS")!,
          },
        ],
      }),
    }),
    PrismaModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoachesModule,
    AdminMembersModule,
    MembershipsModule,
    ClassesModule,
    BookingsModule,
    ExercisesModule,
    WodsModule,
    WorkoutsModule,
    PrsModule,
    AttendanceModule,
    ChallengesModule,
    AnnouncementsModule,
    NotificationsModule,
    AnalyticsModule,
    SettingsModule,
    // AI assistant coach and challenges/achievements engagement polish land
    // in later phases - see docs/architecture.md for the phased plan.
  ],
  providers: [
    // Global default guard: every route requires authentication unless
    // explicitly marked @Public(). RolesGuard then enforces @Roles(...).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_FILTER, useClass: AllExceptionsFilter },
    { provide: APP_INTERCEPTOR, useClass: LoggingInterceptor },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer.apply(RequestIdMiddleware).forRoutes("*");
  }
}
