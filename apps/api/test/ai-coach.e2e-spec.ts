import "./support/disable-ai-key";
import { createHarness } from "./support/harness";
import { gymDateString } from "../src/common/gym-time";

describe("AI Coach (e2e)", () => {
  let h: Awaited<ReturnType<typeof createHarness>>;
  let member: Awaited<ReturnType<typeof h.createMember>>;
  let squatId: string;

  const ask = (token: string, message: string, conversationId?: string) =>
    h.http().post("/ai-coach/messages").set(h.as(token)).send({ message, conversationId });

  beforeAll(async () => {
    h = await createHarness("e2e-ai");
    member = await h.createMember("member");
    squatId = (await h.prisma.client.exercise.findFirstOrThrow({ where: { name: "Back Squat" } })).id;
  });
  afterAll(async () => h.cleanup());

  it("requires authentication", async () => {
    expect((await h.http().post("/ai-coach/messages").send({ message: "hi" })).status).toBe(401);
  });

  it("is honest about which engine answers (no key -> local, data-only assistant)", async () => {
    const res = await ask(member.token, "hello");
    expect(res.status).toBe(200);
    expect(res.body.provider).toBe("local");
    expect(res.body.message.content).toMatch(/basic mode/i);
  });

  it("says so when there is no data instead of inventing any", async () => {
    const prs = await ask(member.token, "What are my PRs?");
    expect(prs.body.message.content).toMatch(/don't have any personal records/i);
    const classes = await ask(member.token, "What classes am I booked into?");
    expect(classes.body.message.content).toMatch(/no upcoming bookings/i);
  });

  it("answers from the member's real data: PRs, progress and today's WOD", async () => {
    await h.http().post("/workouts").set(h.as(member.token)).send({ exerciseId: squatId, weightKg: 85, reps: 5 });
    const prs = await ask(member.token, "what is my squat PR");
    expect(prs.body.message.content).toContain("Back Squat");
    expect(prs.body.message.content).toContain("85");

    const progress = await ask(member.token, "show my progress and streak");
    expect(progress.body.message.content).toMatch(/1 workouts/);

    const today = gymDateString(new Date(), process.env.GYM_TIMEZONE ?? "Europe/Belgrade");
    const wod = await h.http().post("/wods").set(h.as(h.admin.token)).send({
      title: `${h.tag} AI WOD`,
      date: today,
      type: "AMRAP",
      sections: [{ type: "STRENGTH", order: 1, exercises: [{ exerciseId: squatId, order: 1, sets: 5, reps: 3 }] }],
    });
    // draft is not shared with members
    expect((await ask(member.token, "what is today's WOD?")).body.message.content).not.toContain(`${h.tag} AI WOD`);
    await h.http().patch(`/wods/${wod.body.id}/publish`).set(h.as(h.admin.token));
    const shown = await ask(member.token, "what is today's WOD?");
    expect(shown.body.message.content).toContain(`${h.tag} AI WOD`);
    expect(shown.body.message.content).toContain("Back Squat");
    await h.http().patch(`/wods/${wod.body.id}/archive`).set(h.as(h.admin.token));
  });

  it("does not play doctor", async () => {
    const m = await h.createMember("health");
    const res = await ask(m.token, "my knee has pain when I squat, what should I do?");
    expect(res.body.message.content).toMatch(/not a medical professional/i);
  });

  it("keeps a persistent per-member conversation and never exposes another member's", async () => {
    const a = await h.createMember("conv-a");
    const b = await h.createMember("conv-b");
    const first = await ask(a.token, "hi there");
    const second = await ask(a.token, "and my progress?", first.body.conversationId);
    expect(second.body.conversationId).toBe(first.body.conversationId);

    const latest = await h.http().get("/ai-coach/conversation").set(h.as(a.token));
    expect(latest.body.messages.map((m: { role: string }) => m.role)).toEqual(["USER", "ASSISTANT", "USER", "ASSISTANT"]);

    expect((await ask(b.token, "sneaky", first.body.conversationId)).status).toBe(404);
    const bLatest = await h.http().get("/ai-coach/conversation").set(h.as(b.token));
    expect(bLatest.body.messages).toEqual([]);
  });

  it("validates input", async () => {
    expect((await ask(member.token, "")).status).toBe(400);
    expect((await ask(member.token, "x".repeat(1001))).status).toBe(400);
  });

  it("enforces the per-member daily limit", async () => {
    const m = await h.createMember("limit");
    const statuses: number[] = [];
    for (let i = 0; i < 13; i++) statuses.push((await ask(m.token, "hello")).status);
    expect(statuses.slice(0, 12).every((s) => s === 200)).toBe(true);
    expect(statuses[12]).toBe(429);
  });
});
