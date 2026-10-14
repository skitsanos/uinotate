import { createHmac, randomUUID, timingSafeEqual } from "node:crypto";

export const MAX_BODY_BYTES = 1024 * 1024;
export const SESSION_TTL_SECONDS = 15 * 60;

class RequestError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}

function json(body, status = 200, headers = {}) {
  return Response.json(body, { status, headers: {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers
  } });
}

function sameOrigin(request) {
  const origin = request.headers.get("Origin");
  if (origin && origin !== new URL(request.url).origin) throw new RequestError(403, "This demo only accepts same-origin requests.");
}

function validScreenshot(shot) {
  if (!shot || shot.mimeType !== "image/png" || typeof shot.dataUrl !== "string" || shot.dataUrl.length > 400022
    || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(shot.dataUrl)) return false;
  const bytes = Buffer.from(shot.dataUrl.slice("data:image/png;base64,".length), "base64");
  return bytes.length >= 33 && bytes.length <= 300000 && shot.byteLength === bytes.length
    && Number.isInteger(shot.width) && Number.isInteger(shot.height)
    && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(16) === shot.width && bytes.readUInt32BE(20) === shot.height
    && shot.width >= 1 && shot.height >= 1 && shot.width <= 1200 && shot.height <= 1200;
}

function validate(payload) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)
    || typeof payload.id !== "string" || !payload.id || payload.id.length > 150
    || typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 5000
    || !["feedback", "annotation"].includes(payload.type)
    || (payload.schemaVersion !== undefined && payload.schemaVersion !== 1)) throw new RequestError(422, "Invalid feedback payload.");
  if (payload.type === "annotation" && (!payload.element || typeof payload.element.selector !== "string"
    || !payload.element.selector.trim() || payload.element.selector.length > 2048)) throw new RequestError(422, "An annotation needs an element selector.");
  if (payload.type === "feedback" && payload.element != null) throw new RequestError(422, "Quick feedback must not include an element.");
  if (payload.element && Object.hasOwn(payload.element, "screenshot") && !validScreenshot(payload.element.screenshot)) throw new RequestError(422, "Invalid screenshot.");
}

async function readJSON(request) {
  const contentLength = Number(request.headers.get("Content-Length"));
  if (contentLength > MAX_BODY_BYTES) throw new RequestError(413, "Feedback is limited to 1 MiB.");
  const reader = request.body?.getReader();
  if (!reader) throw new RequestError(400, "Expected a JSON body.");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new RequestError(413, "Feedback is limited to 1 MiB."); }
      chunks.push(Buffer.from(value));
    }
  } finally { reader.releaseLock(); }
  try { return JSON.parse(Buffer.concat(chunks, size).toString("utf8")); }
  catch { throw new RequestError(400, "Invalid JSON."); }
}

/** Public demo sessions illustrate Bearer transport; they do not identify users. */
export function createDemoApi({ secret, now = Date.now } = {}) {
  const configured = () => {
    if (typeof secret !== "string" || secret.length < 32) throw new RequestError(503, "The demo service is not configured.");
  };
  const sign = (encoded) => createHmac("sha256", secret).update(encoded).digest("base64url");
  const authenticate = (request) => {
    configured();
    const authorization = request.headers.get("Authorization") || "";
    if (!authorization.startsWith("Bearer ") || authorization.length > 1024) throw new RequestError(401, "A valid demo session is required.");
    const [encoded, signature, extra] = authorization.slice(7).split(".");
    if (!encoded || !signature || extra !== undefined || !/^[A-Za-z0-9_-]+$/.test(encoded) || !/^[A-Za-z0-9_-]{43}$/.test(signature)) throw new RequestError(401, "Invalid demo session.");
    const expected = Buffer.from(sign(encoded));
    const supplied = Buffer.from(signature);
    if (expected.length !== supplied.length || !timingSafeEqual(expected, supplied)) throw new RequestError(401, "Invalid demo session.");
    let claims;
    try { claims = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")); }
    catch { throw new RequestError(401, "Invalid demo session."); }
    const seconds = Math.floor(now() / 1000);
    if (!claims || claims.aud !== "uinotate-demo" || claims.origin !== new URL(request.url).origin || typeof claims.nonce !== "string"
      || !Number.isInteger(claims.exp) || claims.exp <= seconds) throw new RequestError(401, "Expired or invalid demo session.");
  };
  const handle = (operation) => async (request) => {
    try { sameOrigin(request); return await operation(request); }
    catch (error) {
      if (error instanceof RequestError) return json({ error: error.message }, error.status,
        error.status === 401 ? { "WWW-Authenticate": 'Bearer realm="uinotate-demo"' } : {});
      // Keep submitted messages, screenshots, credentials, and internal errors out of logs/responses.
      return json({ error: "The demo service could not process this request." }, 500);
    }
  };
  return {
    session: handle(async (request) => {
      if (request.method !== "GET") return json({ error: "Method not allowed." }, 405, { Allow: "GET" });
      configured();
      const exp = Math.floor(now() / 1000) + SESSION_TTL_SECONDS;
      const encoded = Buffer.from(JSON.stringify({ aud: "uinotate-demo", origin: new URL(request.url).origin, nonce: randomUUID(), exp })).toString("base64url");
      return json({ token: encoded + "." + sign(encoded), expiresAt: new Date(exp * 1000).toISOString() });
    }),
    feedback: handle(async (request) => {
      if (request.method !== "POST") return json({ error: "Method not allowed." }, 405, { Allow: "POST" });
      authenticate(request);
      if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("Content-Type") || "")) throw new RequestError(415, "Expected application/json.");
      const payload = await readJSON(request);
      validate(payload);
      if (request.headers.get("X-Demo-Fail") === "true") return json({ error: "Simulated failure." }, 503);
      // Replace this acknowledgment with application storage in a real feedback service.
      const result = { accepted: true, id: payload.id, stored: false };
      if (payload.element?.screenshot) {
        const { mimeType, width, height, byteLength } = payload.element.screenshot;
        result.screenshot = { mimeType, width, height, byteLength };
      }
      return json(result, 201);
    })
  };
}
