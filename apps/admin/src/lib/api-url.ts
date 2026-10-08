// Server-only. Never exposed to the browser (no NEXT_PUBLIC_ prefix) - the
// admin dashboard always talks to the backend through its own Route
// Handlers, so the API base URL and any tokens never reach client JS.
export const API_URL = process.env.API_URL ?? "http://localhost:3000";
