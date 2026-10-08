import { RequestIdMiddleware } from "./request-id.middleware";

describe("RequestIdMiddleware", () => {
  it("generates a request id when none is supplied", () => {
    const middleware = new RequestIdMiddleware();
    const req: any = { headers: {} };
    const setHeader = jest.fn();
    const res: any = { setHeader };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toEqual(expect.any(String));
    expect(req.requestId.length).toBeGreaterThan(0);
    expect(setHeader).toHaveBeenCalledWith("x-request-id", req.requestId);
    expect(next).toHaveBeenCalled();
  });

  it("reuses an incoming x-request-id header so a request can be traced across services", () => {
    const middleware = new RequestIdMiddleware();
    const req: any = { headers: { "x-request-id": "incoming-id-123" } };
    const setHeader = jest.fn();
    const res: any = { setHeader };
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(req.requestId).toBe("incoming-id-123");
    expect(setHeader).toHaveBeenCalledWith("x-request-id", "incoming-id-123");
  });
});
