import { BadRequestException, ConflictException, ForbiddenException, Injectable, UnauthorizedException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtService, JwtSignOptions } from "@nestjs/jwt";
import * as bcrypt from "bcryptjs";
import { Role, UserStatus } from "@illyrian/database";
import { AuthResponse, AuthTokens } from "@illyrian/types";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { MailerService } from "../../common/mailer/mailer.service";
import { StructuredLogger } from "../../common/logger/structured-logger.service";
import { RegisterDto } from "./dto/register.dto";
import { LoginDto } from "./dto/login.dto";
import { ResetPasswordDto } from "./dto/reset-password.dto";
import { generateOpaqueToken, hashToken } from "./tokens.util";

export interface RequestMeta {
  ipAddress?: string;
  userAgent?: string;
}

const GENERIC_LOGIN_ERROR = "Invalid email or password";
const EMAIL_VERIFICATION_TTL_HOURS = 48;
const PASSWORD_RESET_TTL_MINUTES = 30;

@Injectable()
export class AuthService {
  private readonly logger = new StructuredLogger("AuthService");

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto, meta: RequestMeta): Promise<AuthResponse> {
    if (this.config.get<string>("ALLOW_PUBLIC_REGISTRATION") !== "true") {
      throw new ForbiddenException("Accounts are created by the gym. Ask the gym to set up your login.");
    }
    const existing = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (existing) {
      // Deliberately vague to avoid confirming which emails are registered
      // would be nicer, but registration UX needs a clear "already have an
      // account" signal - acceptable tradeoff for a gym membership app.
      throw new ConflictException("An account with this email already exists");
    }

    const saltRounds = this.config.get<number>("BCRYPT_SALT_ROUNDS")!;
    const passwordHash = await bcrypt.hash(dto.password, saltRounds);

    const user = await this.prisma.client.user.create({
      data: {
        email: dto.email.toLowerCase(),
        passwordHash,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        role: Role.MEMBER,
      },
    });

    await this.audit.record({
      actorId: user.id,
      action: "user.register",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
    });

    await this.sendEmailVerification(user.id, user.email);

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async login(dto: LoginDto, meta: RequestMeta): Promise<AuthResponse> {
    const user = await this.prisma.client.user.findUnique({ where: { email: dto.email.toLowerCase() } });
    if (!user || user.deletedAt) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }
    if (user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("This account is not active. Contact the gym for assistance.");
    }

    const valid = await bcrypt.compare(dto.password, user.passwordHash);
    if (!valid) {
      throw new UnauthorizedException(GENERIC_LOGIN_ERROR);
    }

    await this.audit.record({
      actorId: user.id,
      action: "user.login",
      entityType: "User",
      entityId: user.id,
      ipAddress: meta.ipAddress,
    });

    const tokens = await this.issueTokenPair(user.id, user.email, user.role, meta);
    return { user: this.toAuthUser(user), tokens };
  }

  async refresh(rawRefreshToken: string, meta: RequestMeta): Promise<AuthTokens> {
    const tokenHash = hashToken(rawRefreshToken);
    const stored = await this.prisma.client.refreshToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.revokedAt || stored.expiresAt < new Date()) {
      throw new UnauthorizedException("Refresh token is invalid or has expired");
    }

    const user = await this.prisma.client.user.findUnique({ where: { id: stored.userId } });
    if (!user || user.deletedAt || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException("Account is no longer active");
    }

    // Rotate: revoke the presented token and issue a brand new pair. If a
    // revoked token is ever presented again, it indicates the token was
    // stolen/replayed - callers may treat this as a signal to revoke the
    // entire session family in a future iteration.
    await this.prisma.client.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });

    return this.issueTokenPair(user.id, user.email, user.role, meta);
  }

  async logout(rawRefreshToken: string): Promise<void> {
    const tokenHash = hashToken(rawRefreshToken);
    await this.prisma.client.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async forgotPassword(email: string): Promise<void> {
    const user = await this.prisma.client.user.findUnique({ where: { email: email.toLowerCase() } });
    // Always respond as if successful - never reveal whether an email is
    // registered (prevents account enumeration).
    if (!user || user.deletedAt) return;

    const { raw, hash } = generateOpaqueToken();
    await this.prisma.client.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + PASSWORD_RESET_TTL_MINUTES * 60_000),
      },
    });

    await this.mailer.send({
      to: user.email,
      subject: "Reset your Illyrian Gym password",
      text: `Use this token to reset your password (valid ${PASSWORD_RESET_TTL_MINUTES} minutes): ${raw}`,
    });
  }

  async resetPassword(dto: ResetPasswordDto): Promise<void> {
    const tokenHash = hashToken(dto.token);
    const stored = await this.prisma.client.passwordResetToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException("Reset token is invalid or has expired");
    }

    const saltRounds = this.config.get<number>("BCRYPT_SALT_ROUNDS")!;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: stored.userId }, data: { passwordHash } }),
      this.prisma.client.passwordResetToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
      // Force re-authentication on every device after a password reset.
      this.prisma.client.refreshToken.updateMany({
        where: { userId: stored.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);

    await this.audit.record({
      actorId: stored.userId,
      action: "user.password_reset",
      entityType: "User",
      entityId: stored.userId,
    });
  }

  async changePassword(userId: string, dto: { currentPassword: string; newPassword: string }): Promise<void> {
    const user = await this.prisma.client.user.findUnique({ where: { id: userId } });
    if (!user) throw new UnauthorizedException("Account not found");

    const valid = await bcrypt.compare(dto.currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException("Current password is incorrect");

    const saltRounds = this.config.get<number>("BCRYPT_SALT_ROUNDS")!;
    const passwordHash = await bcrypt.hash(dto.newPassword, saltRounds);

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: userId }, data: { passwordHash } }),
      // Force re-authentication on every other device after a password change.
      this.prisma.client.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);

    await this.audit.record({ actorId: userId, action: "user.password_change", entityType: "User", entityId: userId });
  }

  async verifyEmail(rawToken: string): Promise<void> {
    const tokenHash = hashToken(rawToken);
    const stored = await this.prisma.client.emailVerificationToken.findUnique({ where: { tokenHash } });

    if (!stored || stored.usedAt || stored.expiresAt < new Date()) {
      throw new BadRequestException("Verification token is invalid or has expired");
    }

    await this.prisma.client.$transaction([
      this.prisma.client.user.update({ where: { id: stored.userId }, data: { emailVerifiedAt: new Date() } }),
      this.prisma.client.emailVerificationToken.update({ where: { id: stored.id }, data: { usedAt: new Date() } }),
    ]);
  }

  // --- internal helpers ---------------------------------------------------

  private async sendEmailVerification(userId: string, email: string): Promise<void> {
    const { raw, hash } = generateOpaqueToken();
    await this.prisma.client.emailVerificationToken.create({
      data: {
        userId,
        tokenHash: hash,
        expiresAt: new Date(Date.now() + EMAIL_VERIFICATION_TTL_HOURS * 3_600_000),
      },
    });
    await this.mailer.send({
      to: email,
      subject: "Verify your Illyrian Gym account",
      text: `Use this token to verify your email (valid ${EMAIL_VERIFICATION_TTL_HOURS}h): ${raw}`,
    });
  }

  private async issueTokenPair(
    userId: string,
    email: string,
    role: Role,
    meta: RequestMeta,
  ): Promise<AuthTokens> {
    const accessExpiresIn = this.config.get<string>("JWT_ACCESS_EXPIRES_IN")!;
    const refreshExpiresIn = this.config.get<string>("JWT_REFRESH_EXPIRES_IN")!;

    const accessToken = await this.jwt.signAsync(
      { sub: userId, email, role },
      {
        secret: this.config.get<string>("JWT_ACCESS_SECRET"),
        expiresIn: accessExpiresIn as JwtSignOptions["expiresIn"],
      },
    );

    const { raw: refreshToken, hash: refreshHash } = generateOpaqueToken();
    await this.prisma.client.refreshToken.create({
      data: {
        userId,
        tokenHash: refreshHash,
        userAgent: meta.userAgent,
        ipAddress: meta.ipAddress,
        expiresAt: new Date(Date.now() + parseDurationMs(refreshExpiresIn)),
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: Math.floor(parseDurationMs(accessExpiresIn) / 1000),
    };
  }

  private toAuthUser(user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: Role;
    status: UserStatus;
    emailVerifiedAt: Date | null;
    profileImageUrl: string | null;
  }) {
    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      role: user.role,
      status: user.status,
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      profileImageUrl: user.profileImageUrl,
    };
  }
}

/** Parses simple durations like "15m", "30d", "1h" into milliseconds. */
function parseDurationMs(duration: string): number {
  const match = /^(\d+)(ms|s|m|h|d)$/.exec(duration.trim());
  if (!match) throw new Error(`Invalid duration format: "${duration}"`);
  const value = Number(match[1]);
  const unit = match[2];
  const unitMs: Record<string, number> = { ms: 1, s: 1_000, m: 60_000, h: 3_600_000, d: 86_400_000 };
  return value * unitMs[unit];
}
