import { randomBytes } from "node:crypto";
import { createDemoApi } from "../netlify/lib/demo-api.js";

const files = new Map([
  ["/", "examples/index.html"],
  ["/examples/", "examples/index.html"],
  ["/examples/index.html", "examples/index.html"],
  ["/examples/minimal.html", "examples/minimal.html"],
  ["/examples/demo.css", "examples/demo.css"],
  ["/examples/demo.js", "examples/demo.js"],
  ["/examples/minimal.css", "examples/minimal.css"],
  ["/examples/minimal.js", "examples/minimal.js"],
  ["/lib.js", "lib.js"],
  ["/uinotate.css", "uinotate.css"]
]);
const base = new URL("../", import.meta.url);

export function createHandler({ secret = process.env.UINOTATE_DEMO_SIGNING_SECRET || randomBytes(32).toString("hex") } = {}) {
  const api = createDemoApi({ secret });
  return async function handle(request) {
    const url = new URL(request.url);
    if (url.pathname === "/") return new Response(null, { status: 302, headers: { Location: "/examples/" } });
    if (url.pathname === "/api/demo-session") return api.session(request);
    if (url.pathname === "/api/feedback") return api.feedback(request);
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
