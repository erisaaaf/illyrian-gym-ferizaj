import { ArgumentsHost, BadRequestException, ForbiddenException } from "@nestjs/common";
import { AllExceptionsFilter } from "./all-exceptions.filter";

function buildHost(requestId = "req-1", originalUrl = "/test") {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const res = { status };
  const req = { requestId, originalUrl };

  const host = {
    switchToHttp: () => ({
      getRequest: () => req,
      getResponse: () => res,
    }),
  } as unknown as ArgumentsHost;

  return { host, status, json };
}

describe("AllExceptionsFilter", () => {
  const filter = new AllExceptionsFilter();

  it("maps a plain HttpException to the ApiErrorResponse shape", () => {
    const { host, status, json } = buildHost();
    filter.catch(new ForbiddenException("Not allowed"), host);

    expect(status).toHaveBeenCalledWith(403);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: 403,
        message: "Not allowed",
        requestId: "req-1",
        path: "/test",
      }),
    );
  });

  it("converts class-validator array messages into a structured errors field", () => {
    const { host, status, json } = buildHost();
    filter.catch(new BadRequestException({ message: ["email must be an email"] }), host);

    expect(status).toHaveBeenCalledWith(400);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Validation failed",
        errors: { validation: ["email must be an email"] },
      }),
    );
  });

  it("never leaks an unexpected error's message or stack to the client", () => {
    const { host, status, json } = buildHost();
    filter.catch(new Error("db connection string leaked here"), host);

    expect(status).toHaveBeenCalledWith(500);
    const payload = json.mock.calls[0][0];
    expect(payload.message).toBe("Internal server error");
    expect(JSON.stringify(payload)).not.toContain("leaked");
  });
});
