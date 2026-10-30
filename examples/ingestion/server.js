import { Database } from "bun:sqlite";
import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import Ajv from "ajv/dist/2020.js";
import addFormats from "ajv-formats";
import { PNG } from "pngjs";
import schema from "../../docs/payload-v1.schema.json";

export const MAX_BODY_BYTES = 4 * 1024 * 1024;
const ajv = new Ajv({ allErrors: false });
addFormats(ajv);
const valid = ajv.compile(schema);
const base = new URL("./", import.meta.url);
const assets = new Map([
  ["/", ["index.html", base]], ["/dashboard.css", ["dashboard.css", base]],
  ["/dashboard.js", ["dashboard.js", base]], ["/try", ["try.html", base]],
  ["/try.js", ["try.js", base]],
  ["/lib.js", ["../../lib.js", base]], ["/uinotate.css", ["../../uinotate.css", base]]
]);
const headers = {
  "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "no-referrer", "X-Frame-Options": "DENY",
  "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; object-src 'none'; base-uri 'none'; frame-ancestors 'none'; form-action 'self'"
};
class HTTPError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
const json = (body, status = 200, extra = {}) => Response.json(body, { status, headers: { ...headers, ...extra } });
function authorize(request, token) {
  const supplied = Buffer.from(request.headers.get("Authorization") || "");
  const expected = Buffer.from("Bearer " + token);
  if (supplied.length !== expected.length || !timingSafeEqual(supplied, expected)) throw new HTTPError(401, "A valid access key is required.");
}
async function readPayload(request) {
  if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) throw new HTTPError(415, "Use application/json.");
  if (Number(request.headers.get("Content-Length")) > MAX_BODY_BYTES) throw new HTTPError(413, "The request exceeds 4 MiB.");
  const reader = request.body?.getReader();
  if (!reader) throw new HTTPError(400, "A JSON body is required.");
  const chunks = [];
  let bytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > MAX_BODY_BYTES) { await reader.cancel(); throw new HTTPError(413, "The request exceeds 4 MiB."); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, bytes).toString("utf8")); }
  catch { throw new HTTPError(400, "Invalid JSON."); }
}
function validate(payload) {
  if (!valid(payload)) throw new HTTPError(422, "Payload does not match schemaVersion 1: " + (valid.errors[0].instancePath || "/") + " " + valid.errors[0].message);
  if (payload.id.length > 150 || payload.message.length > 5000 || (payload.element?.selector.length || 0) > 2048) throw new HTTPError(422, "ID, message, or selector exceeds this example's limits.");
  const shot = payload.element?.screenshot;
  if (!shot) return;
  const encoded = shot.dataUrl.slice("data:image/png;base64,".length);
  const bytes = Buffer.from(encoded, "base64");
  if (bytes.toString("base64") !== encoded || bytes.length !== shot.byteLength || bytes.length < 33
    || !bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    || bytes.toString("ascii", 12, 16) !== "IHDR" || bytes.readUInt32BE(16) !== shot.width || bytes.readUInt32BE(20) !== shot.height) throw new HTTPError(422, "Screenshot bytes and dimensions do not match.");
  // Check the bounded IHDR dimensions before decoding, then verify CRCs and image data.
  try {
    const image = PNG.sync.read(bytes, { checkCRC: true });
    if (image.width !== shot.width || image.height !== shot.height) throw new Error("Dimensions differ.");
  } catch { throw new HTTPError(422, "Screenshot must be a decodable PNG with valid checksums."); }
}
function canonical(value) {
  if (Array.isArray(value)) return "[" + value.map(canonical).join(",") + "]";
  if (value && typeof value === "object") return "{" + Object.keys(value).sort().map(key => JSON.stringify(key) + ":" + canonical(value[key])).join(",") + "}";
  return JSON.stringify(value);
}
const summaryColumns = "id, client_id AS clientId, received_at AS receivedAt, type, category, message, page_url AS pageUrl, page_title AS pageTitle, selector, has_screenshot AS hasScreenshot";

export function createIngestionServer({ databasePath = ".data/ingestion.sqlite", ingestToken, dashboardToken, allowedOrigins = [] } = {}) {
  for (const token of [ingestToken, dashboardToken]) if (typeof token !== "string" || token.length < 32 || token.length > 512 || /\s/.test(token)) throw new Error("Set distinct UINOTATE_INGEST_TOKEN and UINOTATE_DASHBOARD_TOKEN values of 32–512 non-whitespace characters.");
  if (ingestToken === dashboardToken) throw new Error("Submission and dashboard keys must be different.");
  for (const origin of allowedOrigins) if (!/^https?:$/.test(new URL(origin).protocol) || new URL(origin).origin !== origin) throw new Error("Allowed origins must be exact HTTP(S) origins, without a path or trailing slash.");
  if (databasePath !== ":memory:") mkdirSync(dirname(resolve(databasePath)), { recursive: true, mode: 0o700 });
  const db = new Database(databasePath, { create: true, strict: true });
  db.exec(`PRAGMA journal_mode = WAL; PRAGMA synchronous = FULL;
    CREATE TABLE IF NOT EXISTS feedback (
      sequence INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, client_id TEXT NOT NULL UNIQUE,
      received_at TEXT NOT NULL, type TEXT NOT NULL, category TEXT NOT NULL, message TEXT NOT NULL,
      page_url TEXT NOT NULL, page_title TEXT NOT NULL, selector TEXT, has_screenshot INTEGER NOT NULL,
      digest TEXT NOT NULL, payload TEXT NOT NULL
    );`);
  const insert = db.query("INSERT INTO feedback (id,client_id,received_at,type,category,message,page_url,page_title,selector,has_screenshot,digest,payload) VALUES (?,?,?,?,?,?,?,?,?,?,?,?) ON CONFLICT(client_id) DO NOTHING");
  return {
    close: () => db.close(),
    fetch: async (request) => {
      const url = new URL(request.url);
      const ingestion = url.pathname === "/api/feedback";
      const origin = request.headers.get("Origin");
      const permitted = !origin || origin === url.origin || (ingestion && allowedOrigins.includes(origin));
      const cors = ingestion && origin && permitted ? { "Access-Control-Allow-Origin": origin, Vary: "Origin" } : {};
      try {
        if (!permitted) throw new HTTPError(403, "Origin is not allowed.");
        if (ingestion) {
          if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...headers, ...cors, "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Authorization", "Access-Control-Max-Age": "600" } });
          if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { ...cors, Allow: "POST, OPTIONS" });
          authorize(request, ingestToken);
          const payload = await readPayload(request);
          validate(payload);
          let digest;
          try { digest = createHash("sha256").update(canonical(payload)).digest("hex"); }
          catch { throw new HTTPError(422, "Payload nesting is too deep."); }
          const id = randomUUID();
          const receivedAt = new Date().toISOString();
          const result = insert.run(id, payload.id, receivedAt, payload.type, payload.category, payload.message, payload.page.url, payload.page.title, payload.element?.selector || null, Number(Boolean(payload.element?.screenshot)), digest, JSON.stringify(payload));
          const record = db.query("SELECT id, received_at AS receivedAt, digest FROM feedback WHERE client_id = ?").get(payload.id);
          if (record.digest !== digest) throw new HTTPError(409, "This client ID already belongs to a different payload.");
          return json({ accepted: true, stored: true, id: record.id, receivedAt: record.receivedAt, duplicate: result.changes === 0 }, result.changes ? 201 : 200, cors);
        }
        if (url.pathname === "/api/records" || url.pathname.startsWith("/api/records/")) {
          if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
          authorize(request, dashboardToken);
          if (url.pathname !== "/api/records") {
            const record = db.query("SELECT id, received_at AS receivedAt, payload FROM feedback WHERE id = ?").get(url.pathname.slice("/api/records/".length));
            if (!record) throw new HTTPError(404, "Record not found.");
            return json({ ...record, payload: JSON.parse(record.payload) });
          }
          const type = url.searchParams.get("type") || "";
          const category = url.searchParams.get("category") || "";
          const q = (url.searchParams.get("q") || "").trim();
          const page = Number(url.searchParams.get("page") || 1);
          if ((type && !["feedback", "annotation"].includes(type)) || (category && !["general", "style", "layout", "content", "interaction", "other"].includes(category)) || q.length > 200 || !Number.isSafeInteger(page) || page < 1 || page > 1000000) throw new HTTPError(400, "Invalid filter or page.");
          const clauses = [], params = [];
          if (type) { clauses.push("type = ?"); params.push(type); }
          if (category) { clauses.push("category = ?"); params.push(category); }
          if (q) { clauses.push("(message LIKE ? ESCAPE '\\' OR page_url LIKE ? ESCAPE '\\' OR page_title LIKE ? ESCAPE '\\' OR selector LIKE ? ESCAPE '\\')"); const match = "%" + q.replace(/[\\%_]/g, "\\$&") + "%"; params.push(match, match, match, match); }
          const where = clauses.length ? " WHERE " + clauses.join(" AND ") : "";
          const total = db.query("SELECT count(*) AS count FROM feedback" + where).get(...params).count;
          const records = db.query("SELECT " + summaryColumns + " FROM feedback" + where + " ORDER BY sequence DESC LIMIT 25 OFFSET ?").all(...params, (page - 1) * 25);
          const stats = db.query("SELECT count(*) AS total, coalesce(sum(type = 'feedback'),0) AS feedback, coalesce(sum(type = 'annotation'),0) AS annotations, coalesce(sum(has_screenshot),0) AS screenshots FROM feedback").get();
          return json({ records, total, page, pageSize: 25, stats });
        }
        const asset = assets.get(url.pathname);
        if (!asset) throw new HTTPError(404, "Not found.");
        if (!["GET", "HEAD"].includes(request.method)) return json({ error: "Method not allowed." }, 405, { Allow: "GET, HEAD" });
        const file = Bun.file(new URL(asset[0], asset[1]));
        return new Response(request.method === "HEAD" ? null : file, { headers: { ...headers, "Content-Type": file.type } });
      } catch (error) {
        if (error instanceof HTTPError) return json({ error: error.message }, error.status, { ...cors, ...(error.status === 401 ? { "WWW-Authenticate": 'Bearer realm="uinotate-ingestion"' } : {}) });
        // No payloads, credentials, or internal database errors in logs or responses.
        return json({ error: "The ingestion service could not process this request." }, 500, cors);
      }
    }
  };
}

if (import.meta.main) {
  const app = createIngestionServer({
    databasePath: process.env.UINOTATE_DATABASE_PATH || ".data/ingestion.sqlite",
    ingestToken: process.env.UINOTATE_INGEST_TOKEN, dashboardToken: process.env.UINOTATE_DASHBOARD_TOKEN,
    allowedOrigins: (process.env.UINOTATE_ALLOWED_ORIGINS || "").split(",").map(value => value.trim()).filter(Boolean)
  });
  const server = Bun.serve({ hostname: "127.0.0.1", port: Number(process.env.UINOTATE_INGESTION_PORT || 4180), maxRequestBodySize: MAX_BODY_BYTES, fetch: app.fetch });
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, async () => { await server.stop(false); app.close(); process.exit(0); });
  console.log("Uinotate inbox: " + server.url + " · SQLite storage enabled. Access keys come from your environment.");
}
