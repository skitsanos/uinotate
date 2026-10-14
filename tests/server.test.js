import { describe, expect, test } from "bun:test";
import { createHandler } from "../examples/server.js";
import { PNG, PNG_BYTES } from "./fixtures.js";

const handle = createHandler();
const payload = { id: "demo-id", type: "feedback", message: "A useful note" };
function request(options = {}) {
  return new Request("http://127.0.0.1:4173/api/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer uinotate-demo-token", ...options.headers },
    body: JSON.stringify(options.payload ?? payload)
  });
}

describe("local example server", () => {
  test("serves the playground and library with the correct content types", async () => {
    const redirect = await handle(new Request("http://localhost/"));
    expect(redirect.status).toBe(302);
    expect(redirect.headers.get("Location")).toBe("/examples/");
    for (const path of ["/examples/", "/examples/minimal.html", "/lib.js", "/uinotate.css", "/examples/demo.js", "/examples/demo.css"]) {
      const response = await handle(new Request("http://localhost" + path));
      expect(response.status).toBe(200);
      expect((await response.text()).length).toBeGreaterThan(20);
    }
    expect((await handle(new Request("http://localhost/.git/config"))).status).toBe(404);
  });
  test("requires Bearer authentication and validates JSON", async () => {
    expect((await handle(request({ headers: { Authorization: "Bearer wrong" } }))).status).toBe(401);
    expect((await handle(request({ payload: { ...payload, message: " " } }))).status).toBe(422);
    expect((await handle(request({ payload: { ...payload, type: "annotation" } }))).status).toBe(422);
    const response = await handle(request());
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ accepted: true, id: "demo-id" });
  });
  test("supports the simulated failure used to verify draft retention", async () => {
    expect((await handle(request({ headers: { "X-Demo-Fail": "true" } }))).status).toBe(503);
  });
  test("accepts a PNG annotation and validates image dimensions and byte count", async () => {
    const shot = { mimeType: "image/png", dataUrl: PNG, width: 1, height: 1, byteLength: PNG_BYTES, capturedAt: new Date().toISOString() };
    const annotation = { ...payload, type: "annotation", element: { selector: "#button", screenshot: shot } };
    const response = await handle(request({ payload: annotation }));
    expect(response.status).toBe(201);
    expect((await response.json()).screenshot).toEqual({ mimeType: "image/png", width: 1, height: 1, byteLength: PNG_BYTES });
    for (const bad of [{ ...shot, width: 2 }, { ...shot, byteLength: 999 }, { ...shot, dataUrl: "data:image/png;base64,aGVsbG8=" }, { ...shot, mimeType: "image/svg+xml" }]) {
      expect((await handle(request({ payload: { ...annotation, element: { ...annotation.element, screenshot: bad } } }))).status).toBe(422);
    }
  });
});
