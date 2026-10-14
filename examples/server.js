const files = new Map([
  ["/", "examples/index.html"],
  ["/examples/", "examples/index.html"],
  ["/examples/index.html", "examples/index.html"],
  ["/examples/minimal.html", "examples/minimal.html"],
  ["/examples/demo.css", "examples/demo.css"],
  ["/examples/demo.js", "examples/demo.js"],
  ["/lib.js", "lib.js"],
  ["/uinotate.css", "uinotate.css"]
]);
const base = new URL("../", import.meta.url);

function validScreenshot(shot) {
  if (!shot || shot.mimeType !== "image/png" || typeof shot.dataUrl !== "string" || !/^data:image\/png;base64,[A-Za-z0-9+/]+={0,2}$/.test(shot.dataUrl)) return false;
  const bytes = Buffer.from(shot.dataUrl.slice("data:image/png;base64,".length), "base64");
  return bytes.length >= 33 && bytes.length <= 300000 && shot.byteLength === bytes.length
    && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    && bytes.toString("ascii", 12, 16) === "IHDR" && bytes.readUInt32BE(16) === shot.width && bytes.readUInt32BE(20) === shot.height
    && shot.width >= 1 && shot.height >= 1 && shot.width <= 1200 && shot.height <= 1200;
}

export function createHandler() {
  return async function handle(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response(null, { status: 302, headers: { Location: "/examples/" } });
    if (url.pathname === "/api/feedback") {
      if (request.method !== "POST") return new Response("Method not allowed", { status: 405, headers: { Allow: "POST" } });
      if (request.headers.get("Authorization") !== "Bearer uinotate-demo-token") {
        return Response.json({ error: "Invalid demo token" }, { status: 401 });
      }
      if (!request.headers.get("Content-Type")?.startsWith("application/json")) {
        return Response.json({ error: "Expected JSON" }, { status: 415 });
      }
      let payload;
      try { payload = await request.json(); }
      catch { return Response.json({ error: "Invalid JSON" }, { status: 400 }); }
      if (!payload || typeof payload.message !== "string" || !payload.message.trim() || payload.message.length > 5000
        || !["feedback", "annotation"].includes(payload.type) || (payload.type === "annotation" && !payload.element?.selector)) {
        return Response.json({ error: "Invalid feedback payload" }, { status: 422 });
      }
      if (payload.element?.screenshot && (payload.type !== "annotation" || !validScreenshot(payload.element.screenshot))) return Response.json({ error: "Invalid screenshot" }, { status: 422 });
      if (request.headers.get("X-Demo-Fail") === "true") return Response.json({ error: "Simulated failure" }, { status: 503 });
      const result = { accepted: true, id: payload.id };
      if (payload.element?.screenshot) {
        const { mimeType, width, height, byteLength } = payload.element.screenshot;
        result.screenshot = { mimeType, width, height, byteLength };
      }
      return Response.json(result, { status: 201 });
    }
    if (!["GET", "HEAD"].includes(request.method)) return new Response("Method not allowed", { status: 405 });
    const path = files.get(url.pathname);
    if (!path) return new Response("Not found", { status: 404 });
    const file = Bun.file(new URL(path, base));
    return new Response(request.method === "HEAD" ? null : file, { headers: {
      "Content-Type": file.type,
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    } });
  };
}

if (import.meta.main) {
  const server = Bun.serve({
    hostname: "127.0.0.1",
    port: Number(process.env.UINOTATE_DEMO_PORT || 4173),
    maxRequestBodySize: 1024 * 1024,
    fetch: createHandler()
  });
  console.log("Uinotate playground: " + server.url);
  console.log("Demo only: submissions are acknowledged and discarded; nothing is stored.");
}
