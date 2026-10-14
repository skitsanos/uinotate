import { describe, expect, test } from "bun:test";
import { createDemoApi, MAX_BODY_BYTES, SESSION_TTL_SECONDS } from "../netlify/lib/demo-api.js";
import { config as feedbackConfig } from "../netlify/functions/feedback.mjs";
import { config as sessionConfig } from "../netlify/functions/demo-session.mjs";

const SECRET = "unit-test-signing-key-that-is-not-a-real-deployment-secret";
const BASE = "https://demo.example.test";
const payload = { schemaVersion: 1, id: "test-feedback", type: "feedback", message: "A useful note." };

async function session(api) { return await (await api.session(new Request(BASE + "/api/demo-session"))).json(); }
function post(token, { body = JSON.stringify(payload), headers = {}, origin = BASE } = {}) {
  return new Request(origin + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...headers }, body });
}

describe("public demo API", () => {
  test("issues a non-cacheable session and accepts its Bearer token without retaining feedback", async () => {
    const api = createDemoApi({ secret: SECRET });
    const response = await api.session(new Request(BASE + "/api/demo-session"));
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toBe("no-store");
    const { token, expiresAt } = await response.json();
    expect(token).not.toContain(SECRET);
    expect(Date.parse(expiresAt)).toBeGreaterThan(Date.now());
    const accepted = await api.feedback(post(token));
    expect(accepted.status).toBe(201);
    expect(await accepted.json()).toEqual({ accepted: true, id: payload.id, stored: false });
  });

  test("missing configuration fails closed", async () => {
    const api = createDemoApi();
    expect((await api.session(new Request(BASE + "/api/demo-session"))).status).toBe(503);
    expect((await api.feedback(post("anything"))).status).toBe(503);
  });

  test("rejects forged, malformed, origin-mismatched, and expired tokens", async () => {
    let time = Date.now();
    const api = createDemoApi({ secret: SECRET, now: () => time });
    const { token } = await session(api);
    const forged = token.slice(0, -1) + (token.endsWith("A") ? "B" : "A");
    for (const bad of ["", "uinotate-demo-token", forged, token + ".extra"]) {
      const response = await api.feedback(post(bad));
      expect(response.status).toBe(401);
      expect(response.headers.get("WWW-Authenticate")).toContain("Bearer");
    }
    expect((await api.feedback(post(token, { origin: "https://other.example.test" }))).status).toBe(401);
    time += (SESSION_TTL_SECONDS + 1) * 1000;
    expect((await api.feedback(post(token))).status).toBe(401);
  });

  test("blocks cross-origin session and feedback requests", async () => {
    const api = createDemoApi({ secret: SECRET });
    expect((await api.session(new Request(BASE + "/api/demo-session", { headers: { Origin: "https://other.example.test" } }))).status).toBe(403);
    const { token } = await session(api);
    expect((await api.feedback(post(token, { headers: { Origin: "https://other.example.test" } }))).status).toBe(403);
  });
  test("a small clock difference between function instances does not reject a fresh signed session", async () => {
    const time = Date.now();
    const issuer = createDemoApi({ secret: SECRET, now: () => time + 1000 });
    const receiver = createDemoApi({ secret: SECRET, now: () => time });
    const { token } = await session(issuer);
    expect((await receiver.feedback(post(token))).status).toBe(201);
  });

  test("validates methods, JSON content type, and the payload envelope", async () => {
    const api = createDemoApi({ secret: SECRET });
    const { token } = await session(api);
    expect((await api.feedback(new Request(BASE + "/api/feedback"))).status).toBe(405);
    expect((await api.session(new Request(BASE + "/api/demo-session", { method: "POST" }))).status).toBe(405);
    expect((await api.feedback(post(token, { headers: { "Content-Type": "text/plain" } }))).status).toBe(415);
    expect((await api.feedback(post(token, { body: "{" }))).status).toBe(400);
    for (const invalid of [null, [], { ...payload, message: " " }, { ...payload, schemaVersion: 2 }, { ...payload, id: "" }, { ...payload, type: "annotation" }]) {
      expect((await api.feedback(post(token, { body: JSON.stringify(invalid) }))).status).toBe(422);
    }
  });

  test("limits request size using both content length and the actual streamed body", async () => {
    const api = createDemoApi({ secret: SECRET });
    const { token } = await session(api);
    expect((await api.feedback(post(token, { headers: { "Content-Length": String(MAX_BODY_BYTES + 1) } }))).status).toBe(413);
    expect((await api.feedback(post(token, { body: JSON.stringify({ ...payload, metadata: { oversized: "x".repeat(MAX_BODY_BYTES) } }) }))).status).toBe(413);
  });

  test("function routes include per-IP/domain rate limiting", () => {
    expect(feedbackConfig.path).toContain("/api/feedback");
    expect(sessionConfig.path).toContain("/api/demo-session");
    expect(feedbackConfig.rateLimit).toEqual({ windowLimit: 30, windowSize: 60, aggregateBy: ["ip", "domain"] });
    expect(sessionConfig.rateLimit.windowLimit).toBe(10);
  });
});
