import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { captureElement, captureFilter } from "../src/screenshot.js";
import { PNG, PNG_BYTES, pngCanvas } from "./fixtures.js";

let window;
let document;
let node;
const config = { screenshotMaxDimension: 1200, screenshotMaxBytes: 300000 };
beforeEach(() => {
  window = new Window({ url: "https://example.test/" });
  document = window.document;
  document.body.innerHTML = '<button id="target">Save</button>';
  node = document.getElementById("target");
  node.getBoundingClientRect = () => new window.DOMRect(5, 10, 120, 42);
});
afterEach(async () => { await window.happyDOM.close(); });

describe("element screenshots", () => {
  test("exports a PNG with byte size, pixel dimensions, and a capture timestamp", async () => {
    let options;
    const result = await captureElement(node, config, {}, async (target, settings) => {
      expect(target).toBe(node);
      options = settings;
      return pngCanvas(document);
    });
    expect(result).toMatchObject({ mimeType: "image/png", dataUrl: PNG, byteLength: PNG_BYTES, width: 1, height: 1 });
    expect(Number.isFinite(Date.parse(result.capturedAt))).toBe(true);
    expect(options.fetchRequestInit).toMatchObject({ credentials: "omit", referrerPolicy: "no-referrer" });
  });

  test("limits raster dimensions before rendering large elements", async () => {
    node.getBoundingClientRect = () => new window.DOMRect(0, 0, 4000, 2000);
    let options;
    await captureElement(node, config, {}, async (target, settings) => { options = settings; return pngCanvas(document); });
    expect(options.width).toBe(4000);
    expect(options.height).toBe(2000);
    expect(options.canvasWidth).toBe(1200);
    expect(options.canvasHeight).toBe(600);
    expect(options.pixelRatio).toBe(1);
  });

  test("transparent containers keep their visible ancestor background", async () => {
    const panel = document.createElement("div");
    panel.style.backgroundColor = "white";
    node.parentNode.append(panel);
    panel.append(node);
    let options;
    await captureElement(node, config, {}, async (target, settings) => { options = settings; return pngCanvas(document); });
    expect(options.backgroundColor).toBe("white");
    node.style.backgroundColor = "purple";
    await captureElement(node, config, {}, async (target, settings) => { options = settings; return pngCanvas(document); });
    expect(options.backgroundColor).toBeUndefined();
  });

  test("downscales canvas output until both byte and dimension limits hold", async () => {
    const original = document.createElement.bind(document);
    document.createElement = (tag, ...args) => {
      if (tag !== "canvas") return original(tag, ...args);
      return {
        width: 100, height: 100,
        toDataURL() { return "data:image/png;base64," + Buffer.alloc(this.width * this.height).toString("base64"); },
        getContext() { return { drawImage() {} }; }
      };
    };
    const result = await captureElement(node, { screenshotMaxDimension: 32, screenshotMaxBytes: 1024 }, {}, async () => document.createElement("canvas"));
    expect(result.width).toBeLessThanOrEqual(32);
    expect(result.height).toBeLessThanOrEqual(32);
    expect(result.byteLength).toBeLessThanOrEqual(1024);
  });

  test("rejects capture for private targets and excludes private descendants", async () => {
    document.body.innerHTML = '<section><button>OK</button><input value="private"><textarea>Draft</textarea><select><option>Private selection</option></select><div contenteditable="true">Draft</div><div data-uinotate-private>Secret</div><iframe></iframe><div data-uinotate>Widget</div></section>';
    for (const target of document.querySelectorAll("input, textarea, select, [contenteditable], [data-uinotate-private], iframe, [data-uinotate]")) {
      expect(captureFilter(target)).toBe(false);
      await expect(captureElement(target, config, {}, async () => pngCanvas(document))).rejects.toThrow("excluded");
    }
    expect(captureFilter(document.querySelector("button"))).toBe(true);
    expect(captureFilter(document.querySelector("section"))).toBe(true);
    expect(captureFilter(document.createTextNode("Visible text"))).toBe(true);
  });

  test("an SVG containing private content is excluded despite deep SVG cloning", () => {
    document.body.innerHTML = '<svg><foreignObject><div xmlns="http://www.w3.org/1999/xhtml" data-uinotate-private>Secret</div></foreignObject></svg>';
    expect(captureFilter(document.querySelector("svg"))).toBe(false);
  });

  test("embeds accessible fonts without modifying host stylesheet rules", async () => {
    const style = document.createElement("style");
    style.textContent = '@font-face {font-family: "Demo"; src: url("data:font/woff2;base64,AA==") format("woff2")}';
    document.head.append(style);
    node.style.fontFamily = "Demo";
    const before = Array.from(style.sheet.cssRules, (rule) => rule.cssText);
    let options;
    await captureElement(node, config, {}, async (target, settings) => { options = settings; return pngCanvas(document); });
    expect(options.fontEmbedCSS).toContain("Demo");
    expect(Array.from(style.sheet.cssRules, (rule) => rule.cssText)).toEqual(before);
  });

  test("an aborted capture does not invoke a renderer", async () => {
    const controller = new AbortController();
    controller.abort();
    let calls = 0;
    await expect(captureElement(node, config, { signal: controller.signal }, async () => { calls++; return pngCanvas(document); })).rejects.toThrow("Aborted");
    expect(calls).toBe(0);
  });
});
