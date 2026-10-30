import { buildCorsOptions } from "./cors";

type OriginFn = (origin: string | undefined, cb: (err: Error | null, allow?: boolean) => void) => void;

function allowed(allowList: string[], env: string | undefined, origin: string | undefined): boolean | undefined {
  let result: boolean | undefined;
  (buildCorsOptions(allowList, env).origin as OriginFn)(origin, (_err, allow) => {
    result = allow;
  });
  return result;
}

describe("buildCorsOptions", () => {
  const list = ["https://admin.illyriangym.example"];

  it("always allows requests with no Origin (the native mobile app, curl)", () => {
    expect(allowed(list, "production", undefined)).toBe(true);
    expect(allowed([], "development", undefined)).toBe(true);
  });

  it("allows origins on the explicit allow-list in every environment", () => {
    for (const env of ["development", "staging", "production"]) {
      expect(allowed(list, env, "https://admin.illyriangym.example")).toBe(true);
    }
  });

  it("in development also allows loopback and private-network origins (Expo web via LAN)", () => {
    for (const o of ["http://localhost:8082", "http://127.0.0.1:3001", "http://192.168.0.23:8082", "http://192.168.88.37:8081", "http://10.0.0.5:19006", "http://172.20.1.2:8082"]) {
      expect(allowed(list, "development", o)).toBe(true);
    }
  });

  it("in development still refuses public origins that are not listed", () => {
    for (const o of ["http://evil.example.com", "https://192.168.0.23.evil.com", "http://8.8.8.8:8082", "http://172.32.0.1:8082"]) {
      expect(allowed(list, "development", o)).toBe(false);
    }
  });

  it("in staging/production refuses everything not on the allow-list, even localhost and LAN origins", () => {
    for (const env of ["staging", "production", undefined]) {
      for (const o of ["http://localhost:8082", "http://192.168.0.23:8082", "http://evil.example.com"]) {
        expect(allowed(list, env, o)).toBe(false);
      }
    }
  });
});
