import { randomUUID } from "node:crypto";

const base = process.argv[2] || "http://localhost:8888";
const check = (condition, message) => { if (!condition) throw new Error(message); };
const url = (path) => new URL(path, base);
const request = async (path, options) => fetch(url(path), { ...options, signal: AbortSignal.timeout(20000) });
for (const path of ["/", "/examples/", "/examples/minimal.html", "/examples/demo.js", "/examples/minimal.js", "/examples/demo.css", "/examples/minimal.css", "/lib.js", "/uinotate.css"]) {
  const response = await request(path);
  check(response.status === 200, path + " returned " + response.status);
  check(response.headers.get("X-Content-Type-Options") === "nosniff", path + " is missing its content type protection");
  check((await response.text()).length > 20, path + " is empty");
}
for (const path of ["/src/widget.js", "/netlify/lib/demo-api.js", "/.env", "/package.json"]) check((await request(path)).status === 404, "Private project file is exposed: " + path);
const sessionResponse = await request("/api/demo-session");
check(sessionResponse.status === 200, "Session endpoint returned " + sessionResponse.status);
check(sessionResponse.headers.get("Cache-Control") === "no-store", "Sessions must not be cached");
const session = await sessionResponse.json();
check(typeof session.token === "string" && Date.parse(session.expiresAt) > Date.now(), "Invalid session response");
const payload = { schemaVersion: 1, id: "smoke-" + randomUUID(), type: "feedback", message: "Automated demo smoke check.", metadata: { environment: "smoke-test" } };
const send = (body, headers = {}) => request("/api/feedback", { method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + session.token, ...headers }, body: JSON.stringify(body) });
check((await send(payload, { Authorization: "Bearer invalid" })).status === 401, "Invalid Bearer tokens must be rejected");
const accepted = await send(payload);
check(accepted.status === 201, "Feedback returned " + accepted.status);
check((await accepted.json()).stored === false, "The public demo must not retain feedback");
const png = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a6ioAAAAASUVORK5CYII=";
const annotation = { ...payload, id: "smoke-" + randomUUID(), type: "annotation", element: { selector: "#example", screenshot: { mimeType: "image/png", dataUrl: png, width: 1, height: 1, byteLength: Buffer.from(png.split(",")[1], "base64").length, capturedAt: new Date().toISOString() } } };
const annotated = await send(annotation);
check(annotated.status === 201 && (await annotated.json()).screenshot?.width === 1, "PNG annotation was not accepted");
check((await send(payload, { "X-Demo-Fail": "true" })).status === 503, "Failure simulation is unavailable");
check((await request("/api/demo-session", { headers: { Origin: "https://unrelated.example" } })).status === 403, "Cross-origin session requests must be rejected");
console.log("Smoke checks passed: static files, source isolation, signed sessions, Bearer validation, feedback, PNG annotations, and failure simulation at " + new URL(base).origin + ". No session token or feedback body is printed.");
