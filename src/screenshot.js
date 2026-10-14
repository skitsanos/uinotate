import { toCanvas } from "html-to-image";
import { embedResources } from "html-to-image/es/embed-resources.js";

const PRIVATE_SELECTOR = "[data-uinotate], [data-uinotate-private], input, textarea, select, [contenteditable]:not([contenteditable='false']), iframe, script, noscript, style, link, meta, template, object, embed";

export function canCapture(node) {
  if (node.closest(PRIVATE_SELECTOR)) return false;
  // html-to-image deep-clones SVG nodes without applying its descendant filter.
  if (node.localName === "svg" && node.querySelector(PRIVATE_SELECTOR)) return false;
  return true;
}

export function captureFilter(node) {
  if (node.nodeType !== 1) return true;
  return canCapture(node);
}

function pngSize(dataUrl) {
  const base64 = dataUrl.slice("data:image/png;base64,".length);
  return Math.floor(base64.length * 3 / 4) - (base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0);
}

function backdropColor(node) {
  const view = node.ownerDocument.defaultView;
  const transparent = (color) => !color || color === "transparent" || /^rgba\([^)]*,\s*0(?:\.0+)?\)$/i.test(color);
  if (!transparent(view.getComputedStyle(node).backgroundColor)) return undefined;
  for (let parent = node.parentElement; parent; parent = parent.parentElement) {
    const color = view.getComputedStyle(parent).backgroundColor;
    if (!transparent(color)) return color;
  }
  return undefined;
}

// Read accessible font-face rules without the renderer modifying host stylesheets.
async function fontCSS(node, options) {
  const fonts = new Set();
  const collect = (current) => {
    if (!captureFilter(current)) return;
    node.ownerDocument.defaultView.getComputedStyle(current).fontFamily.split(",").forEach((font) => fonts.add(font.trim().replace(/["']/g, "")));
    Array.from(current.children).forEach(collect);
  };
  collect(node);
  const rules = [];
  const visited = new Set();
  const read = (sheet) => {
    if (!sheet || visited.has(sheet)) return;
    visited.add(sheet);
    let entries;
    try { entries = Array.from(sheet.cssRules || []); }
    catch { return; } // Inaccessible cross-origin stylesheets use fallback fonts.
    const walk = (entries) => entries.forEach((rule) => {
      if (rule.type === 5 && fonts.has(rule.style.getPropertyValue("font-family").trim().replace(/["']/g, ""))) rules.push(rule);
      else if (rule.styleSheet) read(rule.styleSheet);
      else if (rule.cssRules) walk(Array.from(rule.cssRules));
    });
    walk(entries);
  };
  Array.from(node.ownerDocument.styleSheets).forEach(read);
  return (await Promise.all(rules.map((rule) => embedResources(rule.cssText, rule.parentStyleSheet?.href || node.ownerDocument.baseURI, options)))).join("\n");
}

/** Render only the selected subtree. render is injectable for application adapters/tests. */
export async function captureElement(node, config, { signal } = {}, render = toCanvas) {
  if (!canCapture(node)) throw new Error("Screenshots are excluded for form fields, editable content, iframes, and private elements.");
  if (!node.isConnected) throw new Error("That element is no longer on the page.");
  const abortIfNeeded = () => {
    if (signal?.aborted) throw new DOMException("Aborted", "AbortError");
  };
  abortIfNeeded();
  const rect = node.getBoundingClientRect();
  const width = Math.max(1, Math.ceil(node.offsetWidth || rect.width));
  const height = Math.max(1, Math.ceil(node.offsetHeight || rect.height));
  const scale = Math.min(2, node.ownerDocument.defaultView.devicePixelRatio || 1, config.screenshotMaxDimension / Math.max(width, height));
  const options = {
    width, height,
    canvasWidth: Math.max(1, Math.round(width * scale)),
    canvasHeight: Math.max(1, Math.round(height * scale)),
    pixelRatio: 1,
    backgroundColor: backdropColor(node),
    filter: captureFilter,
    includeQueryParams: true,
    preferredFontFormat: "woff2",
    fetchRequestInit: { signal, credentials: "omit", referrerPolicy: "no-referrer" },
    style: { margin: "0", transform: "none", translate: "none", rotate: "none", scale: "none", position: "relative", inset: "auto" }
  };
  options.fontEmbedCSS = await fontCSS(node, options);
  abortIfNeeded();
  let canvas = await render(node, options);
  abortIfNeeded();
  if (!canvas || !canvas.width || !canvas.height || typeof canvas.toDataURL !== "function") throw new Error("The screenshot renderer did not return a canvas.");
  // Guard custom renderers too; never include an oversized canvas in the payload.
  for (let attempt = 0; attempt < 9; attempt++) {
    abortIfNeeded();
    const dataUrl = canvas.toDataURL("image/png");
    if (!dataUrl.startsWith("data:image/png;base64,")) throw new Error("This element could not be exported as a PNG.");
    const byteLength = pngSize(dataUrl);
    const longest = Math.max(canvas.width, canvas.height);
    if (byteLength <= config.screenshotMaxBytes && longest <= config.screenshotMaxDimension) {
      return { mimeType: "image/png", dataUrl, width: canvas.width, height: canvas.height, byteLength, capturedAt: new Date().toISOString() };
    }
    const factor = Math.min(.75, config.screenshotMaxDimension / longest, Math.sqrt(config.screenshotMaxBytes / Math.max(byteLength, 1)) * .9);
    const smaller = node.ownerDocument.createElement("canvas");
    smaller.width = Math.max(1, Math.floor(canvas.width * factor));
    smaller.height = Math.max(1, Math.floor(canvas.height * factor));
    const context = smaller.getContext("2d");
    if (!context) throw new Error("Canvas rendering is unavailable in this browser.");
    context.drawImage(canvas, 0, 0, smaller.width, smaller.height);
    canvas = smaller;
  }
  throw new Error("The screenshot is too large to attach. You can send the annotation without it.");
}
