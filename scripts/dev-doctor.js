#!/usr/bin/env node
/*
 * Development connectivity check: `npm run doctor`
 *
 * Answers "why can't the mobile app reach the API?" without guessing: is the API up,
 * is its database reachable, does it answer on this PC's LAN address (what a phone uses),
 * does CORS allow a browser opened via the LAN address, and is Expo running.
 * Read-only: it sends GET/OPTIONS requests only and never sends credentials.
 *
 * API_PORT (default 3010) and EXPO_PORT (default 8081) can be overridden via environment.
 */
const os = require("os");

const API_PORT = process.env.API_PORT || "3010";
const EXPO_PORT = process.env.EXPO_PORT || "8081";

const lanAddresses = Object.values(os.networkInterfaces())
  .flat()
  .filter((i) => i && i.family === "IPv4" && !i.internal)
  // Skip virtual adapters (Hyper-V / WSL / Docker use 172.16-31.x and 169.254.x)
  .map((i) => i.address)
  .filter((a) => !a.startsWith("169.254.") && !/^172\.(1[6-9]|2\d|3[01])\./.test(a));

let problems = 0;
const ok = (msg) => console.log(`  OK    ${msg}`);
const bad = (msg, fix) => {
  problems++;
  console.log(`  FAIL  ${msg}${fix ? `\n        -> ${fix}` : ""}`);
};

async function get(url, init) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 4000);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

(async () => {
  console.log(`\nIllyrian Gym - development connectivity check (API port ${API_PORT})\n`);

  console.log("API");
  const live = await get(`http://localhost:${API_PORT}/health`);
  if (!live || !live.ok) {
    bad(`nothing answering on http://localhost:${API_PORT}/health`, "start it: npm run dev:api (and check Docker/Postgres is running)");
  } else {
    ok(`API is up on port ${API_PORT}`);
    const ready = await get(`http://localhost:${API_PORT}/health/ready`);
    if (ready && ready.ok) ok("API can reach PostgreSQL");
    else bad("API is up but the database is not reachable", "start Postgres: docker start illyrian-gym-postgres-dev");
  }

  console.log("\nPhone / emulator access (LAN)");
  if (lanAddresses.length === 0) {
    bad("no LAN address found - the PC is not on a network", "connect to the same wifi as your phone");
  }
  for (const ip of lanAddresses) {
    const res = await get(`http://${ip}:${API_PORT}/health`);
    if (res && res.ok) ok(`API answers on http://${ip}:${API_PORT} (a phone on this network uses this address)`);
    else bad(`API does not answer on http://${ip}:${API_PORT}`, "the API must listen on all interfaces (it does by default) and Windows Firewall must allow node.exe inbound");

    const pre = await get(`http://${ip}:${API_PORT}/auth/login`, {
      method: "OPTIONS",
      headers: { Origin: `http://${ip}:${EXPO_PORT}`, "Access-Control-Request-Method": "POST", "Access-Control-Request-Headers": "content-type" },
    });
    if (pre && pre.headers.get("access-control-allow-origin")) ok(`CORS allows a browser page opened at http://${ip}:${EXPO_PORT}`);
    else if (res && res.ok) bad(`CORS would block a browser page opened at http://${ip}:${EXPO_PORT}`, "NODE_ENV must be 'development' for LAN origins to be allowed");
  }

  console.log("\nExpo");
  const expo = await get(`http://localhost:${EXPO_PORT}/status`);
  if (expo && (await expo.text()).includes("running")) ok(`Expo dev server is running on port ${EXPO_PORT}`);
  else bad(`Expo is not running on port ${EXPO_PORT}`, "start it: npm run dev:mobile (use EXPO_PORT=8082 if you started it with --port 8082)");

  console.log(
    problems === 0
      ? "\nEverything looks reachable. The app derives its API address from the Expo host automatically; no .env edit is needed.\n"
      : `\n${problems} problem(s) found - fix the FAIL lines above and run \`npm run doctor\` again.\n`,
  );
  // Set the code instead of calling process.exit(): exiting while fetch sockets are closing crashes Node on Windows.
  process.exitCode = problems === 0 ? 0 : 1;
})();
