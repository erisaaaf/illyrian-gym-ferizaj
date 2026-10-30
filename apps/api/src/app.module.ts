import { MiddlewareConsumer, Module, NestModule } from "@nestjs/common";
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from "@nestjs/core";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { ThrottlerGuard, ThrottlerModule } from "@nestjs/throttler";
import { validateEnv } from "./config/env.validation";
import { PrismaModule } from "./prisma/prisma.module";
import { CommonModule } from "./common/common.module";
import { AuthModule } from "./modules/auth/auth.module";
import { UsersModule } from "./modules/users/users.module";
import { HealthModule } from "./modules/health/health.module";
import { CoachesModule } from "./modules/coaches/coaches.module";
import { AdminMembersModule } from "./modules/admin-members/admin-members.module";
import { MembershipsModule } from "./modules/memberships/memberships.module";
import { FinanceModule } from "./modules/finance/finance.module";
import { CheckInModule } from "./modules/check-in/check-in.module";
import { StaffModule } from "./modules/staff/staff.module";
import { ReportsModule } from "./modules/reports/reports.module";
import { CoachingModule } from "./modules/coaching/coaching.module";
import { BodyProgressModule } from "./modules/body-progress/body-progress.module";
import { CommunicationsModule } from "./modules/communications/communications.module";
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
import { ProgressModule } from "./modules/progress/progress.module";
import { AiCoachModule } from "./modules/ai-coach/ai-coach.module";
import { RequestIdMiddleware } from "./common/middleware/request-id.middleware";
import { AllExceptionsFilter } from "./common/filters/all-exceptions.filter";
import { LoggingInterceptor } from "./common/interceptors/logging.interceptor";
import { JwtAuthGuard } from "./common/guards/jwt-auth.guard";
import { RolesGuard } from "./common/guards/roles.guard";
import { PasswordChangeGuard } from "./common/guards/password-change.guard";

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
    CommonModule,
    HealthModule,
    AuthModule,
    UsersModule,
    CoachesModule,
    AdminMembersModule,
    MembershipsModule,
    FinanceModule,
    CheckInModule,
    StaffModule,
    ReportsModule,
    CoachingModule,
    BodyProgressModule,
    CommunicationsModule,
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
    ProgressModule,
    AiCoachModule,
  ],
  providers: [
    // Global default guard: every route requires authentication unless
    // explicitly marked @Public(). RolesGuard then enforces @Roles(...).
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: PasswordChangeGuard },
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
