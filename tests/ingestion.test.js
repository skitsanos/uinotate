import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { PNG as PNGDecoder } from "pngjs";
import { createIngestionServer, MAX_BODY_BYTES } from "../examples/ingestion/server.js";
import feedback from "../docs/payload-examples/feedback.json";
import annotation from "../docs/payload-examples/annotation.json";

const ingestToken = "test-submission-key-" + "a".repeat(32);
const dashboardToken = "test-viewing-key-" + "b".repeat(32);
const base = "http://127.0.0.1:4180";
let directory, app;
beforeEach(async () => { directory = await mkdtemp(join(tmpdir(), "uinotate-inbox-")); app = createIngestionServer({ databasePath: join(directory, "feedback.sqlite"), ingestToken, dashboardToken, allowedOrigins: ["https://example.test"] }); });
afterEach(async () => { app.close(); await rm(directory, { recursive: true, force: true }); });
const get = (path = "/api/records", token = dashboardToken, extra = {}) => app.fetch(new Request(base + path, { headers: { Authorization: "Bearer " + token, ...extra } }));
const post = (payload = feedback, token = ingestToken, extra = {}) => app.fetch(new Request(base + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + token, ...extra }, body: JSON.stringify(payload) }));

describe("ingestion inbox", () => {
  test("requires distinct keys and keeps submission access separate from reading", async () => {
    expect(() => createIngestionServer({ ingestToken: "short", dashboardToken })).toThrow("32");
    expect(() => createIngestionServer({ ingestToken, dashboardToken: ingestToken })).toThrow("different");
    expect((await post(feedback, dashboardToken)).status).toBe(401);
    expect((await get("/api/records", ingestToken)).status).toBe(401);
    expect((await get("/api/records", "wrong")).status).toBe(401);
    expect((await get()).headers.get("Cache-Control")).toBe("no-store");
  });
  test("persists complete feedback and a decodable screenshot across reopening SQLite", async () => {
    const received = await post(annotation);
    expect(received.status).toBe(201);
    const accepted = await received.json();
    expect(accepted.stored).toBe(true);
    expect(accepted.id).not.toBe(annotation.id);
    expect(Number.isFinite(Date.parse(accepted.receivedAt))).toBe(true);
    app.close(); app = createIngestionServer({ databasePath: join(directory, "feedback.sqlite"), ingestToken, dashboardToken });
    const list = await (await get()).json();
    expect(list.stats).toEqual({ total: 1, feedback: 0, annotations: 1, screenshots: 1 });
    expect(list.records[0].hasScreenshot).toBe(1);
    expect(JSON.stringify(list)).not.toContain("data:image");
    const detail = await (await get("/api/records/" + accepted.id)).json();
    expect(detail.payload).toEqual(annotation);
    expect(PNGDecoder.sync.read(Buffer.from(detail.payload.element.screenshot.dataUrl.split(",")[1], "base64")).width).toBe(1);
    expect((await get("/api/records/" + accepted.id, ingestToken)).status).toBe(401);
  });
  test("replays are deduplicated while changed content for an existing ID conflicts", async () => {
    const first = await (await post()).json();
    const replay = await post({ ...feedback, page: { ...feedback.page } });
    expect(replay.status).toBe(200);
    expect(await replay.json()).toMatchObject({ id: first.id, duplicate: true });
    expect((await post({ ...feedback, message: "Different" })).status).toBe(409);
    expect((await (await get()).json()).total).toBe(1);
  });
  test("validates the full contract, optional image, dates, and PNG contents", async () => {
    const withoutImage = structuredClone(annotation); delete withoutImage.element.screenshot;
    expect((await post(withoutImage)).status).toBe(201);
    const missingPage = { ...feedback }; delete missingPage.page;
    for (const bad of [missingPage, { ...feedback, createdAt: "not-a-date" }, { ...feedback, category: "style" }, { ...annotation, element: null }, { ...feedback, message: " " }, { ...feedback, message: "x".repeat(5001) }]) expect((await post(bad)).status).toBe(422);
    for (const change of [{ width: 2 }, { byteLength: 999 }, { dataUrl: "data:image/png;base64,YQ==" }]) {
      const bad = structuredClone(annotation); Object.assign(bad.element.screenshot, change); expect((await post(bad)).status).toBe(422);
    }
    const corrupted = structuredClone(annotation), bytes = Buffer.from(corrupted.element.screenshot.dataUrl.split(",")[1], "base64");
    bytes[bytes.length - 1] ^= 1; corrupted.element.screenshot.dataUrl = "data:image/png;base64," + bytes.toString("base64");
    expect((await post(corrupted)).status).toBe(422);
  });
  test("rejects malformed, oversized, and wrong-content-type bodies", async () => {
    expect((await post(feedback, ingestToken, { "Content-Type": "text/plain" })).status).toBe(415);
    expect((await app.fetch(new Request(base + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ingestToken }, body: "{" }))).status).toBe(400);
    expect((await post(feedback, ingestToken, { "Content-Length": String(MAX_BODY_BYTES + 1) })).status).toBe(413);
    const body = new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(MAX_BODY_BYTES + 1)); controller.close(); } });
    expect((await app.fetch(new Request(base + "/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + ingestToken }, body, duplex: "half" }))).status).toBe(413);
  });
  test("allows configured ingestion CORS without exposing the reading API", async () => {
    const preflight = await app.fetch(new Request(base + "/api/feedback", { method: "OPTIONS", headers: { Origin: "https://example.test", "Access-Control-Request-Headers": "authorization, content-type" } }));
    expect(preflight.status).toBe(204); expect(preflight.headers.get("Access-Control-Allow-Origin")).toBe("https://example.test");
    const rejected = await post(feedback, "wrong", { Origin: "https://example.test" });
    expect(rejected.status).toBe(401); expect(rejected.headers.get("Access-Control-Allow-Origin")).toBe("https://example.test");
    expect((await post(feedback, ingestToken, { Origin: "https://unrelated.test" })).status).toBe(403);
    expect((await get("/api/records", dashboardToken, { Origin: "https://example.test" })).status).toBe(403);
  });
  test("filters and paginates records with literal search terms and bound SQL", async () => {
    for (let index = 0; index < 27; index++) await post({ ...feedback, id: "entry-" + index, message: index === 26 ? "100% done <script>alert(1)</script>" : "Feedback " + index });
    await post(annotation);
    const first = await (await get()).json(); expect(first.records).toHaveLength(25); expect(first.total).toBe(28);
    expect((await (await get("/api/records?page=2")).json()).records).toHaveLength(3);
    expect((await (await get("/api/records?type=annotation&category=layout")).json()).total).toBe(1);
    expect((await (await get("/api/records?q=" + encodeURIComponent("100%"))).json()).total).toBe(1);
    expect((await (await get("/api/records?q=" + encodeURIComponent("' OR 1=1 --"))).json()).total).toBe(0);
    expect((await get("/api/records?page=0")).status).toBe(400);
    expect((await get("/api/records?type=unknown")).status).toBe(400);
  });
  test("serves only explicit public files and never exposes SQLite, keys, or source", async () => {
    for (const path of ["/", "/try", "/dashboard.js", "/dashboard.css", "/try.js", "/lib.js", "/uinotate.css"]) {
      const response = await app.fetch(new Request(base + path)); expect(response.status).toBe(200); expect((await response.text()).length).toBeGreaterThan(20);
      expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff");
    }
    for (const path of ["/.data/ingestion.sqlite", "/.env", "/server.js", "/package.json", "/api/records/missing"]) expect((await get(path)).status).toBe(404);
    expect((await app.fetch(new Request(base + "/api/records", { method: "DELETE" }))).status).toBe(405);
  });
});
