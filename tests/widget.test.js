import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { Window } from "happy-dom";
import { PNG, pngCanvas } from "./fixtures.js";

const source = await Bun.file(new URL("../lib.js", import.meta.url)).text();
let window;
let document;
let widget;

beforeEach(() => {
  window = new Window({ url: "https://example.test/project?access_token=private#secret" });
  document = window.document;
  document.title = "Example project";
  document.body.innerHTML = '<main id="app"><button id="save-button" class="primary">Save changes</button><button>Cancel</button><input id="private" value="private value"></main>';
  window.eval(source);
});

afterEach(async () => {
  window.Uinotate.destroy();
  await window.happyDOM.close();
});

function mount(options = {}) {
  widget = window.Uinotate.init({ captureScreenshot: false, ...options });
  return widget;
}

function target(id = "save-button") {
  const node = document.getElementById(id);
  node.getBoundingClientRect = () => new window.DOMRect(10, 20, 120, 42);
  return node;
}

async function send(message = "Please improve the spacing.", type = "feedback") {
  widget.textarea.value = message;
  await widget.submit(type);
}

describe("Uinotate integration", () => {
  test("loading the library alone does not mount a widget", () => {
    expect(window.Uinotate.version).toBe("0.1.0");
    expect(window.Uinotate.instance).toBeNull();
    expect(document.querySelector("[data-uinotate]")).toBeNull();
  });

  test("automatic startup respects configuration and script attributes", () => {
    const script = document.createElement("script");
    script.setAttribute("data-uinotate-auto", "");
    script.dataset.position = "bottom";
    script.dataset.endpoint = "/api/automatic";
    window.UinotateConfig = { position: "left", metadata: { project: "automatic" } };
    Object.defineProperty(document, "currentScript", { configurable: true, get: () => script });
    window.eval(source);
    document.dispatchEvent(new window.Event("DOMContentLoaded"));
    const instance = window.Uinotate.instance;
    expect(instance.config.position).toBe("bottom");
    expect(instance.config.apiUrl).toBe("https://example.test/api/automatic");
    expect(instance.config.metadata).toEqual({ project: "automatic" });
    expect(document.querySelectorAll(".uinotate-root").length).toBe(1);
  });

  test("initializes once, validates replacements, and cleans up on destroy", () => {
    const first = mount();
    expect(document.querySelectorAll(".uinotate-root").length).toBe(1);
    expect(() => window.Uinotate.init({ position: "diagonal" })).toThrow("position");
    expect(window.Uinotate.instance).toBe(first);
    mount({ position: "left", offset: 90 });
    expect(first.destroyed).toBe(true);
    expect(widget.root.dataset.position).toBe("left");
    expect(widget.root.style.getPropertyValue("--uinotate-offset")).toBe("90px");
    widget.startAnnotation();
    widget.destroy();
    document.getElementById("save-button").click();
    expect(document.querySelectorAll("[data-uinotate]").length).toBe(0);
    expect(window.Uinotate.instance).toBeNull();
    expect(() => widget.update({})).toThrow("destroyed");
  });

  test("launcher click keeps the expanded menu usable after hover", () => {
    mount();
    widget.root.dispatchEvent(new window.Event("pointerenter"));
    widget.launcher.click();
    expect(widget.launcher.getAttribute("aria-expanded")).toBe("true");
    expect(widget.menu.hasAttribute("inert")).toBe(false);
    widget.root.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    expect(widget.launcher.getAttribute("aria-expanded")).toBe("false");
    expect(widget.menu.hasAttribute("inert")).toBe(true);
  });

  test("changing a theme removes old inline overrides and keeps overrides scoped", () => {
    mount({ theme: { "--uinotate-accent": "red", "--uinotate-radius": "4px", color: "blue" } });
    expect(widget.dialog.style.getPropertyValue("--uinotate-accent")).toBe("red");
    widget.update({ position: "top", theme: { "--uinotate-accent": "green" } });
    expect(widget.root.dataset.position).toBe("top");
    expect(widget.dialog.style.getPropertyValue("--uinotate-radius")).toBe("");
    expect(document.body.style.length).toBe(0);
    expect(widget.dialog.style.color).toBe("");
  });

  test("POSTs JSON with a refreshed Bearer token, safe page URL, and metadata", async () => {
    let request;
    let success;
    window.fetch = async (url, options) => {
      request = { url, options };
      return new window.Response(null, { status: 204 });
    };
    mount({ apiUrl: "/api/feedback", token: async () => "fresh-token", metadata: { project: "demo" }, onSuccess: (payload) => { success = payload; } });
    widget.openFeedback();
    await send("  Useful feedback  ");
    expect(request.url).toBe("https://example.test/api/feedback");
    expect(request.options.method).toBe("POST");
    expect(request.options.headers.get("Authorization")).toBe("Bearer fresh-token");
    expect(request.options.headers.get("Content-Type")).toBe("application/json");
    expect(request.options.credentials).toBe("omit");
    expect(request.options.referrerPolicy).toBe("no-referrer");
    const payload = JSON.parse(request.options.body);
    expect(payload.type).toBe("feedback");
    expect(payload.message).toBe("Useful feedback");
    expect(payload.page.url).toBe("https://example.test/project");
    expect(payload.metadata).toEqual({ project: "demo" });
    expect(payload.element).toBeUndefined();
    expect(JSON.stringify(payload)).not.toContain("fresh-token");
    expect(success.id).toBe(payload.id);
    expect(widget.content.textContent).toContain("Thanks for the nudge.");
  });

  test("captures the exact selected DOM element and suppresses its normal click", async () => {
    let normalClicks = 0;
    let payload;
    const node = target();
    node.addEventListener("click", () => normalClicks++);
    mount({ onSubmit: async (value) => { payload = value; } });
    widget.startAnnotation();
    node.dispatchEvent(new window.MouseEvent("click", { bubbles: true, cancelable: true }));
    expect(normalClicks).toBe(0);
    expect(widget.picking).toBe(false);
    expect(widget.dialog.open).toBe(true);
    widget.category.value = "layout";
    await send("The button is too close to the edge.", "annotation");
    expect(payload.element.selector).toBe("#save-button");
    expect(document.querySelector(payload.element.selector)).toBe(node);
    expect(payload.category).toBe("layout");
    expect(payload.element.rect).toEqual({ x: 10, y: 20, width: 120, height: 42, pageX: 10, pageY: 20 });
    expect(payload.element.styles).toHaveProperty("display");
    expect(payload.element.text).toBeUndefined();
    node.click();
    expect(normalClicks).toBe(1);
  });

  test("selectors stay unambiguous for duplicate IDs and escaped IDs", () => {
    mount();
    const node = target();
    node.id = "duplicate";
    document.querySelector("#app > button:last-of-type").id = "duplicate";
    widget.select(node);
    widget.textarea.value = "A note";
    const selector = widget.payload("annotation").element.selector;
    expect(document.querySelectorAll(selector).length).toBe(1);
    expect(document.querySelector(selector)).toBe(node);
    node.id = "save:button.detail";
    widget.select(node);
    widget.textarea.value = "A note";
    const escaped = widget.payload("annotation").element.selector;
    expect(document.querySelector(escaped)).toBe(node);
  });

  test("text capture is opt-in and avoids form values and editable content", () => {
    mount({ includeElementText: true, collectStyles: false });
    widget.select(target());
    widget.textarea.value = "A note";
    expect(widget.payload("annotation").element.text).toBe("Save changes");
    expect(widget.payload("annotation").element.styles).toBeUndefined();
    widget.select(target("private"));
    widget.textarea.value = "A note";
    expect(widget.payload("annotation").element.text).toBeUndefined();
    const editable = document.createElement("div");
    editable.contentEditable = "true";
    editable.textContent = "Private draft";
    editable.getBoundingClientRect = () => new window.DOMRect(0, 0, 100, 20);
    document.body.append(editable);
    widget.select(editable);
    widget.textarea.value = "A note";
    expect(widget.payload("annotation").element.text).toBeUndefined();
  });

  test("keyboard selection works and Escape removes the selection state", () => {
    mount();
    const node = target();
    widget.startAnnotation();
    expect(document.body.hasAttribute("tabindex")).toBe(false);
    node.focus();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Enter", bubbles: true, cancelable: true }));
    expect(widget.selected).toBe(node);
    expect(widget.dialog.open).toBe(true);
    widget.closeDialog();
    widget.startAnnotation();
    document.dispatchEvent(new window.KeyboardEvent("keydown", { key: "Escape", bubbles: true, cancelable: true }));
    expect(widget.picking).toBe(false);
    expect(widget.highlight.hidden).toBe(true);
    expect(widget.picker.hidden).toBe(true);
  });

  test("retains the draft across failure, close, and retry", async () => {
    let calls = 0;
    window.fetch = async () => new window.Response(null, { status: ++calls === 1 ? 503 : 201 });
    mount({ apiUrl: "/api/feedback" });
    widget.openFeedback();
    await send("Do not lose this message.");
    expect(widget.status.textContent).toContain("503");
    expect(widget.textarea.disabled).toBe(false);
    widget.closeDialog();
    widget.openFeedback();
    expect(widget.textarea.value).toBe("Do not lose this message.");
    await widget.submit("feedback");
    expect(widget.content.textContent).toContain("Thanks for the nudge.");
    widget.closeDialog();
    widget.openFeedback();
    expect(widget.textarea.value).toBe("");
  });

  test("times out callbacks without erasing the message", async () => {
    let signal;
    mount({ requestTimeout: 15, onSubmit: (payload, context) => { signal = context.signal; return new Promise(() => {}); } });
    widget.openFeedback();
    await send("Keep this draft.");
    expect(signal.aborted).toBe(true);
    expect(widget.status.textContent).toContain("too long");
    expect(widget.textarea.value).toBe("Keep this draft.");
    expect(widget.busy).toBe(false);
  });

  test("a token provider that times out never starts a late network request", async () => {
    let fetches = 0;
    let resolveToken;
    window.fetch = async () => { fetches++; return new window.Response(null, { status: 201 }); };
    mount({ apiUrl: "/api/feedback", requestTimeout: 15, token: () => new Promise((resolve) => { resolveToken = resolve; }) });
    widget.openFeedback();
    await send("Keep my note.");
    resolveToken("late-token");
    await Promise.resolve();
    await Promise.resolve();
    expect(fetches).toBe(0);
    expect(widget.status.textContent).toContain("too long");
  });

  test("blocks duplicate submits and aborts pending work on destroy", async () => {
    let calls = 0;
    let signal;
    let succeeded = false;
    mount({ onSubmit: (payload, context) => { calls++; signal = context.signal; return new Promise(() => {}); }, onSuccess: () => { succeeded = true; } });
    widget.openFeedback();
    widget.textarea.value = "In flight";
    const pending = widget.submit("feedback");
    await widget.submit("feedback");
    expect(calls).toBe(1);
    widget.destroy();
    await pending;
    expect(signal.aborted).toBe(true);
    expect(succeeded).toBe(false);
    expect(document.querySelectorAll("[data-uinotate]").length).toBe(0);
  });

  test("reports removed elements instead of sending stale context", async () => {
    let called = false;
    mount({ onSubmit: () => { called = true; } });
    const node = target();
    widget.select(node);
    node.remove();
    await send("This target was removed.", "annotation");
    expect(called).toBe(false);
    expect(widget.status.textContent).toContain("no longer on the page");
    expect(widget.textarea.value).toBe("This target was removed.");
  });

  test("rejects empty feedback and reports missing transport", async () => {
    mount();
    widget.openFeedback();
    widget.textarea.value = "   ";
    widget.content.querySelector("form").dispatchEvent(new window.Event("submit", { cancelable: true }));
    expect(widget.textarea.validationMessage).toContain("write a message");
    await send("A message");
    expect(widget.status.textContent).toContain("configure apiUrl or onSubmit");
  });

  test("replacing forms releases their view listeners", () => {
    mount();
    for (let index = 0; index < 10; index++) { widget.openFeedback(); widget.openAbout(); }
    expect(widget.viewListeners.length).toBe(0);
    widget.openFeedback();
    expect(widget.viewListeners.length).toBe(2);
  });

  test("includes a captured PNG in the annotation POST and preserves its selection context", async () => {
    let request;
    window.fetch = async (url, options) => { request = JSON.parse(options.body); return new window.Response(null, { status: 201 }); };
    const node = target();
    mount({ apiUrl: "/api/feedback", captureScreenshot: true, screenshotRenderer: async () => pngCanvas(document) });
    widget.select(node);
    await widget.capturePromise;
    expect(widget.screenshotPreview.src).toBe(PNG);
    expect(widget.screenshot.status).toBe("ready");
    node.getBoundingClientRect = () => new window.DOMRect(300, 400, 120, 42);
    await send("Screenshot attached.", "annotation");
    expect(request.element.screenshot.dataUrl).toBe(PNG);
    expect(request.element.screenshot.mimeType).toBe("image/png");
    expect(request.element.rect.x).toBe(10);
    expect(request.element.rect.y).toBe(20);
  });

  test("capture failure allows a text annotation and a successful retake", async () => {
    let fail = true;
    mount({ captureScreenshot: true, screenshotRenderer: async () => { if (fail) throw new Error("Renderer failed"); return pngCanvas(document); } });
    widget.select(target());
    await widget.capturePromise;
    expect(widget.screenshot.status).toBe("error");
    expect(widget.submitButton.disabled).toBe(false);
    widget.textarea.value = "Keep my note.";
    expect(widget.payload("annotation").element.screenshot).toBeUndefined();
    fail = false;
    widget.retakeButton.click();
    await widget.capturePromise;
    expect(widget.screenshot.status).toBe("ready");
    expect(widget.textarea.value).toBe("Keep my note.");
    expect(widget.payload("annotation").element.screenshot.dataUrl).toBe(PNG);
  });

  test("unchecking attachment can send immediately while a capture is pending", async () => {
    let received;
    mount({ captureScreenshot: true, screenshotRenderer: () => new Promise(() => {}), onSubmit: async (payload) => { received = payload; } });
    widget.select(target());
    expect(widget.submitButton.disabled).toBe(true);
    widget.screenshotToggle.checked = false;
    widget.screenshotToggle.dispatchEvent(new window.Event("change"));
    expect(widget.submitButton.disabled).toBe(false);
    await send("Text only.", "annotation");
    expect(received.element.screenshot).toBeUndefined();
    expect(widget.content.textContent).toContain("Thanks for the nudge.");
  });

  test("private targets are excluded without calling the screenshot renderer", async () => {
    let calls = 0;
    mount({ captureScreenshot: true, screenshotRenderer: async () => { calls++; return pngCanvas(document); } });
    widget.select(target("private"));
    expect(widget.screenshot.status).toBe("excluded");
    expect(widget.screenshotToggle.checked).toBe(false);
    expect(widget.submitButton.disabled).toBe(false);
    expect(calls).toBe(0);
  });

  test("a late capture cannot replace the current element's image", async () => {
    let resolveFirst;
    mount({ captureScreenshot: true, screenshotRenderer: async (node) => {
      if (node.id === "save-button") return await new Promise((resolve) => { resolveFirst = resolve; });
      return pngCanvas(document);
    } });
    widget.select(target());
    // Let the font preparation finish and invoke the injected renderer.
    for (let index = 0; index < 10 && !resolveFirst; index++) await Promise.resolve();
    const second = document.querySelector("#app > button:last-of-type");
    second.id = "second-button";
    second.getBoundingClientRect = () => new window.DOMRect(30, 40, 100, 30);
    widget.select(second);
    await widget.capturePromise;
    resolveFirst(pngCanvas(document));
    await Promise.resolve();
    expect(widget.annotationContext.id).toBe("second-button");
    expect(widget.screenshot.status).toBe("ready");
    expect(widget.selected).toBe(second);
  });

  test("capture timeout restores sending and does not erase the annotation", async () => {
    mount({ captureScreenshot: true, screenshotTimeout: 15, screenshotRenderer: () => new Promise(() => {}) });
    widget.select(target());
    widget.textarea.value = "Keep this draft.";
    await widget.capturePromise;
    expect(widget.screenshot.status).toBe("error");
    expect(widget.submitButton.disabled).toBe(false);
    expect(widget.textarea.value).toBe("Keep this draft.");
  });

  test("disabling screenshots cancels capture without losing the annotation draft", async () => {
    mount({ captureScreenshot: true, screenshotRenderer: () => new Promise(() => {}) });
    widget.select(target());
    widget.textarea.value = "My draft";
    widget.update({ captureScreenshot: false });
    expect(widget.captureController).toBeNull();
    expect(widget.textarea.value).toBe("My draft");
    expect(widget.content.querySelector(".uinotate-screenshot")).toBeNull();
    expect(widget.payload("annotation").element.screenshot).toBeUndefined();
  });
});
