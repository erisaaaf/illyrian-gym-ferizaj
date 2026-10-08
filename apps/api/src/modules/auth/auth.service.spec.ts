import { ConflictException, ForbiddenException, UnauthorizedException } from "@nestjs/common";
import * as bcrypt from "bcryptjs";
import { AuthService } from "./auth.service";
import { PrismaService } from "../../prisma/prisma.service";
import { AuditService } from "../../common/audit/audit.service";
import { MailerService } from "../../common/mailer/mailer.service";

jest.mock("bcryptjs", () => ({
  hash: jest.fn(async (v: string) => `hashed:${v}`),
  compare: jest.fn(async (plain: string, hash: string) => hash === `hashed:${plain}`),
}));

function buildPrismaMock() {
  return {
    client: {
      user: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
      refreshToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), updateMany: jest.fn() },
      passwordResetToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      emailVerificationToken: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
      $transaction: jest.fn(async (ops: unknown[]) => ops),
    },
  } as unknown as PrismaService;
}

function buildService(prisma = buildPrismaMock(), configOverrides: Record<string, unknown> = {}) {
  const jwt = { signAsync: jest.fn(async () => "signed.jwt.token") } as unknown as import("@nestjs/jwt").JwtService;
  const config = {
    get: jest.fn((key: string) => {
      const values: Record<string, unknown> = {
        BCRYPT_SALT_ROUNDS: 10,
        JWT_ACCESS_SECRET: "test-access-secret",
        JWT_ACCESS_EXPIRES_IN: "15m",
        JWT_REFRESH_EXPIRES_IN: "30d",
        ALLOW_PUBLIC_REGISTRATION: "true",
        ...configOverrides,
      };
      return values[key];
    }),
  } as unknown as import("@nestjs/config").ConfigService;
  const audit = { record: jest.fn() } as unknown as AuditService;
  const mailer = { send: jest.fn() } as unknown as MailerService;

  return { service: new AuthService(prisma, jwt, config, audit, mailer), prisma, jwt, config, audit, mailer };
}

describe("AuthService", () => {
  const meta = { ipAddress: "127.0.0.1", userAgent: "jest" };

  afterEach(() => jest.clearAllMocks());

  describe("register", () => {
    it("is refused when public registration is disabled (accounts are created by the Admin)", async () => {
      const { service, prisma } = buildService(undefined, { ALLOW_PUBLIC_REGISTRATION: "false" });

      await expect(
        service.register({ email: "a@b.com", password: "Password123", firstName: "A", lastName: "B" }, meta),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prisma.client.user.create).not.toHaveBeenCalled();
    });

    it("rejects duplicate emails", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({ id: "existing" });

      await expect(
        service.register(
          { email: "a@b.com", password: "Password123", firstName: "A", lastName: "B" },
          meta,
        ),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it("creates a MEMBER user with a hashed password and issues tokens", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);
      (prisma.client.user.create as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        firstName: "A",
        lastName: "B",
        role: "MEMBER",
        status: "ACTIVE",
        emailVerifiedAt: null,
        profileImageUrl: null,
      });

      const result = await service.register(
        { email: "A@B.com", password: "Password123", firstName: "A", lastName: "B" },
        meta,
      );

      expect(bcrypt.hash).toHaveBeenCalledWith("Password123", 10);
      expect(prisma.client.user.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ email: "a@b.com", role: "MEMBER" }) }),
      );
      expect(result.user.role).toBe("MEMBER");
      expect(result.tokens.accessToken).toBe("signed.jwt.token");
      expect(result.tokens.refreshToken).toEqual(expect.any(String));
      expect(prisma.client.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe("login", () => {
    const dbUser = {
      id: "user-1",
      email: "a@b.com",
      passwordHash: "hashed:Password123",
      firstName: "A",
      lastName: "B",
      role: "MEMBER",
      status: "ACTIVE",
      deletedAt: null,
      emailVerifiedAt: null,
      profileImageUrl: null,
    };

    it("rejects an unknown email with a generic message (no user enumeration)", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(null);

      await expect(service.login({ email: "nope@x.com", password: "x" }, meta)).rejects.toThrow(
        "Invalid email or password",
      );
    });

    it("rejects a wrong password with the same generic message", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(dbUser);

      await expect(service.login({ email: "a@b.com", password: "wrong" }, meta)).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it("rejects a suspended user even with the correct password", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({ ...dbUser, status: "SUSPENDED" });

      await expect(service.login({ email: "a@b.com", password: "Password123" }, meta)).rejects.toThrow(
        /not active/,
      );
    });

    it("issues tokens for correct credentials", async () => {
      const { service, prisma } = buildService();
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue(dbUser);

      const result = await service.login({ email: "a@b.com", password: "Password123" }, meta);
      expect(result.tokens.accessToken).toBe("signed.jwt.token");
      expect(prisma.client.refreshToken.create).toHaveBeenCalled();
    });
  });

  describe("refresh", () => {
    it("rejects a revoked or expired refresh token", async () => {
      const { service, prisma } = buildService();
      (prisma.client.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: new Date(),
        expiresAt: new Date(Date.now() + 100000),
      });

      await expect(service.refresh("raw-token", meta)).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it("rotates a valid token: revokes the old one and issues a new pair", async () => {
      const { service, prisma } = buildService();
      (prisma.client.refreshToken.findUnique as jest.Mock).mockResolvedValue({
        id: "rt-1",
        userId: "user-1",
        revokedAt: null,
        expiresAt: new Date(Date.now() + 100000),
      });
      (prisma.client.user.findUnique as jest.Mock).mockResolvedValue({
        id: "user-1",
        email: "a@b.com",
        role: "MEMBER",
        status: "ACTIVE",
        deletedAt: null,
      });

      const tokens = await service.refresh("raw-token", meta);

      expect(prisma.client.refreshToken.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: "rt-1" }, data: expect.objectContaining({ revokedAt: expect.any(Date) }) }),
      );
      expect(tokens.accessToken).toBe("signed.jwt.token");
    });
  });
});
