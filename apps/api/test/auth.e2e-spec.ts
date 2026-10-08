// Public registration is off by default; this suite exercises the endpoint itself.
import "./support/enable-public-registration";
import { INestApplication, ValidationPipe } from "@nestjs/common";
import { Test } from "@nestjs/testing";
import request from "supertest";
import { AppModule } from "../src/app.module";
import { PrismaService } from "../src/prisma/prisma.service";

/**
 * Full-stack auth flow against a real (test) Postgres database. Requires
 * DATABASE_URL to point at a disposable test database with migrations
 * applied - see docs/testing.md. Run: npm run test:e2e --workspace=apps/api
 */
describe("Auth flow (e2e)", () => {
  let app: INestApplication;
  const email = `e2e-${Date.now()}@illyriangym.dev`;
  let accessToken: string;
  let refreshToken: string;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
    await app.init();
  });

  afterAll(async () => {
    await app.get(PrismaService).client.user.deleteMany({ where: { email } });
    await app.close();
  });

  it("registers a new member", async () => {
    const res = await request(app.getHttpServer()).post("/auth/register").send({
      email,
      password: "Password123",
      firstName: "E2E",
      lastName: "Test",
    });

    expect(res.status).toBe(201);
    expect(res.body.user.role).toBe("MEMBER");
    expect(res.body.tokens.accessToken).toEqual(expect.any(String));
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it("rejects a duplicate registration", async () => {
    const res = await request(app.getHttpServer()).post("/auth/register").send({
      email,
      password: "Password123",
      firstName: "E2E",
      lastName: "Test",
    });
    expect(res.status).toBe(409);
  });

  it("rejects login with the wrong password", async () => {
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password: "WrongPass123" });
    expect(res.status).toBe(401);
  });

  it("logs in with the correct password", async () => {
    const res = await request(app.getHttpServer()).post("/auth/login").send({ email, password: "Password123" });
    expect(res.status).toBe(200);
    accessToken = res.body.tokens.accessToken;
    refreshToken = res.body.tokens.refreshToken;
  });

  it("rejects /users/me without a token", async () => {
    const res = await request(app.getHttpServer()).get("/users/me");
    expect(res.status).toBe(401);
  });

  it("returns the current user's own profile only", async () => {
    const res = await request(app.getHttpServer()).get("/users/me").set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body.email).toBe(email);
  });

  it("rotates the refresh token and rejects reuse of the old one", async () => {
    const first = await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken });
    expect(first.status).toBe(200);
    expect(first.body.accessToken).toEqual(expect.any(String));

    const replay = await request(app.getHttpServer()).post("/auth/refresh").send({ refreshToken });
    expect(replay.status).toBe(401);
  });
});
