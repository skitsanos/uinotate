import { captureElement, canCapture } from "./screenshot.js";

(function (global) {
  "use strict";

  const VERSION = "0.1.0";
  const POSITIONS = ["right", "left", "top", "bottom"];
  const STYLE_PROPERTIES = [
    "display", "position", "color", "background-color", "font-family",
    "font-size", "font-weight", "line-height", "padding", "margin",
    "border", "border-radius", "gap", "align-items", "justify-content"
  ];
  const ICONS = {
    launcher: '<path d="M7 4h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-5l-5 4v-4a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3Z"/><path d="M8 9h8M8 13h5"/>',
    feedback: '<path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8v.5Z"/><path d="M8 10h8M8 14h5"/>',
    annotate: '<path d="M16 3 21 8M4 20l4-1 12-12a2.1 2.1 0 0 0-3-3L5 16l-1 4Z"/><path d="M3 8V4a1 1 0 0 1 1-1h4M16 21h4a1 1 0 0 0 1-1v-4"/>',
    about: '<circle cx="12" cy="12" r="9"/><path d="M12 11v6M12 7h.01"/>',
    close: '<path d="m6 6 12 12M18 6 6 18"/>',
    arrow: '<path d="M5 12h14m-5-5 5 5-5 5"/>',
    check: '<path d="m5 12 4 4L19 6"/>',
    target: '<path d="M8 3H4a1 1 0 0 0-1 1v4M16 3h4a1 1 0 0 1 1 1v4M21 16v4a1 1 0 0 1-1 1h-4M8 21H4a1 1 0 0 1-1-1v-4"/><path d="M8 12h8M12 8v8"/>'
  };
  let active = null;
  let sequence = 0;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  function icon(name) {
    const node = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    node.setAttribute("viewBox", "0 0 24 24");
    node.setAttribute("fill", "none");
    node.setAttribute("stroke", "currentColor");
    node.setAttribute("stroke-width", "1.7");
    node.setAttribute("stroke-linecap", "round");
    node.setAttribute("stroke-linejoin", "round");
    node.setAttribute("aria-hidden", "true");
    node.innerHTML = ICONS[name];
    return node;
  }

  function button(className, label, iconName) {
    const node = element("button", className);
    node.type = "button";
    node.setAttribute("aria-label", label);
    if (iconName) node.append(icon(iconName));
    return node;
  }

  function cssEscape(value) {
    if (global.CSS && global.CSS.escape) return global.CSS.escape(value);
    return Array.from(String(value), (char) => "\\" + char.codePointAt(0).toString(16) + " ").join("");
  }

  function selectorFor(node) {
    const parts = [];
    for (let current = node; current && current.nodeType === 1; current = current.parentElement) {
      let part = current.localName;
      if (current.id) {
        const byId = "#" + cssEscape(current.id);
        if (document.querySelectorAll(byId).length === 1) {
          parts.unshift(byId);
          return parts.join(" > ");
        }
      }
      const parent = current.parentElement;
      if (parent) {
        const siblings = Array.from(parent.children).filter((sibling) => sibling.localName === current.localName);
        if (siblings.length > 1) part += ":nth-of-type(" + (siblings.indexOf(current) + 1) + ")";
      }
      parts.unshift(part);
      const candidate = parts.join(" > ");
      if (document.querySelectorAll(candidate).length === 1) return candidate;
    }
    return parts.join(" > ");
  }

  function rectFor(node) {
    const rect = node.getBoundingClientRect();
    const round = (value) => Math.round(value * 100) / 100;
    return {
      x: round(rect.x), y: round(rect.y), width: round(rect.width), height: round(rect.height),
      pageX: round(rect.x + global.scrollX), pageY: round(rect.y + global.scrollY)
    };
  }

  function normalize(options) {
    const config = Object.assign({
      position: "right", offset: "50%", title: "A little feedback goes a long way.",
      apiUrl: null, token: null, headers: {}, metadata: {}, theme: {},
      zIndex: 2147483000, includeElementText: false, collectStyles: true,
      captureScreenshot: true, screenshotMaxDimension: 1200, screenshotMaxBytes: 300000,
      screenshotTimeout: 8000, screenshotRenderer: null,
      maxLength: 5000, requestTimeout: 15000,
      onSubmit: null, onSuccess: null, onError: null
    }, options);
    if (!POSITIONS.includes(config.position)) throw new TypeError("Uinotate: position must be right, left, top, or bottom.");
    if (typeof config.offset === "number") config.offset += "px";
    if (typeof config.offset !== "string" || /^(auto|inherit|initial|unset|revert|revert-layer)$/i.test(config.offset.trim()) || !global.CSS.supports("top", config.offset)) {
      throw new TypeError("Uinotate: offset must be a valid CSS length or percentage.");
    }
    if (!Number.isInteger(config.maxLength) || config.maxLength < 1) throw new TypeError("Uinotate: maxLength must be a positive integer.");
    if (!Number.isFinite(config.requestTimeout) || config.requestTimeout < 1 || config.requestTimeout > 2147483647) throw new TypeError("Uinotate: requestTimeout must be between 1 and 2147483647 milliseconds.");
    if (!Number.isInteger(config.zIndex) || config.zIndex < 1 || config.zIndex > 2147483640) throw new TypeError("Uinotate: zIndex must be an integer between 1 and 2147483640.");
    for (const name of ["onSubmit", "onSuccess", "onError", "screenshotRenderer"]) {
      if (config[name] != null && typeof config[name] !== "function") throw new TypeError("Uinotate: " + name + " must be a function.");
    }
    if (typeof config.captureScreenshot !== "boolean") throw new TypeError("Uinotate: captureScreenshot must be a boolean.");
    if (!Number.isInteger(config.screenshotMaxDimension) || config.screenshotMaxDimension < 32 || config.screenshotMaxDimension > 4096) throw new TypeError("Uinotate: screenshotMaxDimension must be between 32 and 4096 pixels.");
    if (!Number.isInteger(config.screenshotMaxBytes) || config.screenshotMaxBytes < 1024 || config.screenshotMaxBytes > 2000000) throw new TypeError("Uinotate: screenshotMaxBytes must be between 1024 and 2000000 bytes.");
    if (!Number.isFinite(config.screenshotTimeout) || config.screenshotTimeout < 1 || config.screenshotTimeout > 2147483647) throw new TypeError("Uinotate: screenshotTimeout must be positive and at most 2147483647 milliseconds.");
    if (config.token != null && typeof config.token !== "string" && typeof config.token !== "function") {
      throw new TypeError("Uinotate: token must be a string or a function returning a token.");
    }
    if (config.apiUrl) {
      const url = new URL(config.apiUrl, global.location.href);
      if (!["http:", "https:"].includes(url.protocol) || url.username || url.password) {
        throw new TypeError("Uinotate: apiUrl must be an HTTP(S) URL without embedded credentials.");
      }
      config.apiUrl = url.href;
    }
    for (const name of ["headers", "metadata", "theme"]) {
      if (!config[name] || typeof config[name] !== "object" || Array.isArray(config[name])) throw new TypeError("Uinotate: " + name + " must be an object.");
    }
    // Fail early if application metadata cannot be represented in the JSON payload.
    JSON.stringify(config.metadata);
    return config;
  }

  class Widget {
    constructor(options) {
      this.config = normalize(options);
      this.id = "uinotate-" + (++sequence);
      this.destroyed = false;
      this.picking = false;
      this.busy = false;
      this.selected = null;
      this.listeners = [];
      this.viewListeners = [];
      this.drafts = { feedback: { message: "" }, annotation: { message: "", category: "style" } };
      this.request = null;
      this.captureRevision = 0;
      this.captureController = null;
      this.capturePromise = null;
      this.screenshot = null;
      this.closeTimer = null;
      this.nodes = [];
      this.mount();
    }

    listen(node, type, handler, options) {
      node.addEventListener(type, handler, options);
      this.listeners.push(() => node.removeEventListener(type, handler, options));
    }

    listenView(node, type, handler) {
      node.addEventListener(type, handler);
      this.viewListeners.push(() => node.removeEventListener(type, handler));
    }

    clearView() {
      this.viewListeners.splice(0).forEach((remove) => remove());
      this.content.replaceChildren();
    }

    saveDraft() {
      if (this.currentType && this.textarea && this.textarea.isConnected) {
        this.drafts[this.currentType] = { message: this.textarea.value, category: this.category?.value || "style" };
      }
    }

    owned(node) {
      return node instanceof global.Element && Boolean(node.closest("[data-uinotate]"));
    }

    mount() {
      const root = this.root = element("div", "uinotate-root");
      root.setAttribute("data-uinotate", "dock");
      const launcher = this.launcher = button("uinotate-launcher", "Open feedback tools", "launcher");
      launcher.setAttribute("aria-expanded", "false");
      launcher.setAttribute("aria-controls", this.id + "-menu");
      const menu = this.menu = element("div", "uinotate-menu");
      menu.id = this.id + "-menu";
      menu.setAttribute("role", "group");
      menu.setAttribute("aria-label", "Feedback tools");
      menu.setAttribute("inert", "");
      const orbit = element("div", "uinotate-orbit");
      orbit.setAttribute("aria-hidden", "true");
      menu.append(orbit);
      [
        ["feedback", "Quick feedback", () => this.openFeedback()],
        ["annotate", "Annotate an element", () => this.startAnnotation()],
        ["about", "About Uinotate", () => this.openAbout()]
      ].forEach(([name, label, handler]) => {
        const action = button("uinotate-action uinotate-action--" + name, label, name);
        action.append(element("span", "uinotate-tooltip", label));
        this.listen(action, "click", handler);
        menu.append(action);
      });
      root.append(menu, launcher);

      const dialog = this.dialog = element("dialog", "uinotate-dialog");
      dialog.setAttribute("data-uinotate", "dialog");
      dialog.setAttribute("aria-labelledby", this.id + "-title");
      const shell = element("div", "uinotate-dialog-shell");
      const header = element("div", "uinotate-dialog-header");
      header.append(element("span", "uinotate-wordmark", "uinotate"));
      const close = this.closeButton = button("uinotate-icon-button", "Close dialog", "close");
      header.append(close);
      this.content = element("div", "uinotate-content");
      shell.append(header, this.content);
      dialog.append(shell);

      const highlight = this.highlight = element("div", "uinotate-highlight");
      highlight.setAttribute("data-uinotate", "highlight");
      highlight.setAttribute("aria-hidden", "true");
      highlight.hidden = true;
      this.highlightLabel = element("span", "uinotate-highlight-label");
      highlight.append(this.highlightLabel);

      const picker = this.picker = element("div", "uinotate-picker");
      picker.setAttribute("data-uinotate", "picker");
      picker.hidden = true;
      picker.append(icon("target"));
      const instructions = element("div", "uinotate-picker-instructions");
      instructions.append(element("strong", "", "Pick something to annotate"), element("span", "", "Click an element, or Tab to it and press Enter. Esc cancels."));
      const cancel = button("uinotate-icon-button", "Cancel element selection", "close");
      picker.append(instructions, cancel);
      this.live = element("span", "uinotate-sr-only");
      this.live.setAttribute("role", "status");
      this.live.setAttribute("aria-live", "polite");
      root.append(this.live);

      this.nodes = [root, dialog, highlight, picker];
      this.applyConfig();
      document.body.append(...this.nodes);
      this.listen(root, "pointerenter", () => this.expand());
      this.listen(root, "pointerleave", () => this.scheduleCollapse());
      this.listen(root, "focusin", () => this.expand());
      this.listen(root, "focusout", () => this.scheduleCollapse());
      this.listen(launcher, "click", () => this.expand());
      this.listen(root, "keydown", (event) => {
        if (event.key === "Escape") { this.launcher.focus(); this.expand(false); }
      });
      this.listen(close, "click", () => this.closeDialog());
      this.listen(cancel, "click", () => this.stopAnnotation(true));
      this.listen(dialog, "cancel", (event) => { event.preventDefault(); this.closeDialog(); });
      this.listen(dialog, "close", () => { this.highlight.hidden = true; });
      this.listen(dialog, "click", (event) => {
        if (event.target !== dialog) return;
        const rect = dialog.getBoundingClientRect();
        if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) this.closeDialog();
      });
      this.listen(document, "pointerdown", (event) => {
        if (!this.owned(event.target)) this.expand(false);
      });
      this.listen(document, "pointermove", (event) => {
        if (this.picking && !this.owned(event.target)) this.preview(event.target);
      }, { passive: true });
      this.listen(document, "focusin", (event) => {
        if (this.picking && !this.owned(event.target)) this.preview(event.target);
      });
      this.listen(document, "click", (event) => {
        if (!this.picking || this.owned(event.target)) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (this.eligible(event.target)) this.select(event.target);
      }, true);
      this.listen(document, "keydown", (event) => {
        if (!this.picking) return;
        if (event.key === "Escape") { event.preventDefault(); this.stopAnnotation(true); }
        if ((event.key === "Enter" || event.key === " ") && this.eligible(document.activeElement)) {
          event.preventDefault();
          event.stopImmediatePropagation();
          this.select(document.activeElement);
        }
      }, true);
      const refresh = () => {
        if ((this.picking || this.dialog.open) && this.selected) this.drawHighlight(this.selected);
      };
      this.listen(global, "resize", refresh, { passive: true });
      this.listen(document, "scroll", refresh, { capture: true, passive: true });
    }

    applyConfig() {
      this.root.dataset.position = this.config.position;
      this.root.style.setProperty("--uinotate-offset", this.config.offset);
      this.nodes.forEach((node) => {
        Array.from(node.style).filter((key) => key.startsWith("--uinotate-") && key !== "--uinotate-offset").forEach((key) => node.style.removeProperty(key));
        node.style.setProperty("--uinotate-z-index", String(this.config.zIndex));
        Object.entries(this.config.theme).forEach(([key, value]) => {
          if (key.startsWith("--uinotate-") && key !== "--uinotate-z-index" && key !== "--uinotate-offset") node.style.setProperty(key, String(value));
        });
      });
    }

    update(options) {
      if (this.destroyed) throw new Error("Uinotate: this instance has been destroyed.");
      const previousCapture = this.config.captureScreenshot;
      this.config = normalize(Object.assign({}, this.config, options));
      this.applyConfig();
      if (previousCapture !== this.config.captureScreenshot && this.currentType === "annotation" && this.selected && !this.busy) {
        this.saveDraft();
        this.cancelCapture();
        this.screenshot = null;
        this.renderForm("annotation", this.drafts.annotation.message, this.drafts.annotation.category);
        if (this.config.captureScreenshot) this.captureSelection();
      }
      return this;
    }

    expand(open = true) {
      if (this.destroyed) return;
      global.clearTimeout(this.closeTimer);
      if (this.picking || this.dialog.open) open = false;
      this.root.classList.toggle("uinotate-open", open);
      this.launcher.setAttribute("aria-expanded", String(open));
      this.menu.toggleAttribute("inert", !open);
    }

    scheduleCollapse() {
      global.clearTimeout(this.closeTimer);
      this.closeTimer = global.setTimeout(() => {
        if (!this.root.matches(":hover") && !this.root.contains(document.activeElement)) this.expand(false);
      }, 240);
    }

    heading(title, description) {
      const heading = element("h2", "uinotate-heading", title);
      heading.id = this.id + "-title";
      this.content.append(heading);
      if (description) {
        const subtitle = element("p", "uinotate-description", description);
        subtitle.id = this.id + "-description";
        this.dialog.setAttribute("aria-describedby", subtitle.id);
        this.content.append(subtitle);
      } else this.dialog.removeAttribute("aria-describedby");
    }

    showDialog() {
      this.expand(false);
      if (!this.dialog.open) this.dialog.showModal();
    }

    closeDialog() {
      // Keep a pending submission open so its result and retry state stay visible.
      if (this.busy) return;
      this.saveDraft();
      this.dialog.close();
      this.highlight.hidden = true;
      this.launcher.focus({ preventScroll: true });
      this.expand(false);
    }

    openFeedback() {
      if (this.destroyed || this.busy) return;
      this.saveDraft();
      this.cancelCapture();
      this.stopAnnotation(false);
      this.selected = null;
      this.renderForm("feedback", this.drafts.feedback.message);
    }

    renderForm(type, draft = "", categoryValue = "style") {
      this.clearView();
      this.currentType = type;
      this.heading(type === "annotation" ? "Make it better, right here." : this.config.title,
        type === "annotation" ? "Tell us what you noticed about this element." : "An idea, a rough edge, or something you love. We’re listening.");
      if (type === "annotation" && this.selected) {
        const target = element("div", "uinotate-target");
        target.append(icon("target"));
        const details = element("div", "uinotate-target-details");
        details.append(element("span", "uinotate-eyebrow", "SELECTED ELEMENT"), element("code", "uinotate-selector", selectorFor(this.selected)));
        const change = this.changeTargetButton = element("button", "uinotate-text-button", "Change");
        change.type = "button";
        this.listenView(change, "click", () => this.startAnnotation({ message: this.textarea.value, category: this.category.value }));
        target.append(details, change);
        this.content.append(target);
        if (this.config.captureScreenshot) this.renderScreenshot();
      }
      const form = element("form", "uinotate-form");
      if (type === "annotation") {
        const label = element("label", "uinotate-label", "What is this about?");
        label.htmlFor = this.id + "-category";
        const category = this.category = element("select", "uinotate-select");
        category.id = label.htmlFor;
        [["style", "Visual style"], ["layout", "Layout & positioning"], ["content", "Content"], ["interaction", "Interaction"], ["other", "Something else"]].forEach(([value, text]) => {
          const option = element("option", "", text);
          option.value = value;
          category.append(option);
        });
        category.value = categoryValue;
        form.append(label, category);
      }
      const label = element("label", "uinotate-label", type === "annotation" ? "Your annotation" : "Your feedback");
      label.htmlFor = this.id + "-message";
      const textarea = this.textarea = element("textarea", "uinotate-textarea");
      textarea.id = label.htmlFor;
      textarea.placeholder = type === "annotation" ? "This button feels a little out of place because…" : "I noticed that…";
      textarea.required = true;
      textarea.maxLength = this.config.maxLength;
      textarea.rows = 5;
      textarea.value = draft;
      const meta = element("div", "uinotate-field-meta");
      const hint = element("span", "", "Please avoid sharing sensitive information.");
      hint.id = this.id + "-hint";
      textarea.setAttribute("aria-describedby", hint.id);
      const count = element("span", "uinotate-character-count", draft.length + " / " + this.config.maxLength);
      meta.append(hint, count);
      const status = this.status = element("p", "uinotate-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      status.hidden = true;
      const footer = element("div", "uinotate-form-footer");
      const context = element("span", "uinotate-context-note", type === "annotation" ? "Element details included" : "Page context included");
      const submit = this.submitButton = element("button", "uinotate-primary-button", "Send " + (type === "annotation" ? "annotation" : "feedback"));
      submit.type = "submit";
      submit.append(icon("arrow"));
      footer.append(context, submit);
      form.append(label, textarea, meta, status, footer);
      this.content.append(form);
      this.updateScreenshotView();
      this.listenView(textarea, "input", () => {
        textarea.setCustomValidity("");
        count.textContent = textarea.value.length + " / " + this.config.maxLength;
      });
      this.listenView(form, "submit", (event) => {
        event.preventDefault();
        if (!textarea.value.trim()) {
          textarea.setCustomValidity("Please write a message before sending.");
          textarea.reportValidity();
          return;
        }
        this.submit(type);
      });
      this.showDialog();
      textarea.focus({ preventScroll: true });
    }

    openAbout() {
      if (this.destroyed || this.busy) return;
      this.saveDraft();
      this.cancelCapture();
      this.stopAnnotation(false);
      this.selected = null;
      this.clearView();
      this.currentType = null;
      this.heading("Small widget. Better experiences.", "Uinotate gives your feedback a place to land.");
      const about = element("div", "uinotate-about");
      [["feedback", "Quick feedback", "Share a thought about the page."], ["annotate", "Point to the detail", "Choose an element and tell us what could improve."]].forEach(([name, title, text]) => {
        const row = element("div", "uinotate-about-row");
        const copy = element("div");
        copy.append(element("strong", "", title), element("p", "", text));
        row.append(icon(name), copy);
        about.append(row);
      });
      about.append(element("p", "uinotate-about-privacy", "When you send, this widget shares your message and page context with this website’s configured feedback service. Annotations also include element details and, if attached, a screenshot of its visible content."));
      const footer = element("div", "uinotate-about-footer");
      footer.append(element("span", "", "Uinotate · v" + VERSION), element("span", "", "Made for the little details."));
      this.content.append(about, footer);
      this.showDialog();
    }

    eligible(node) {
      return node instanceof global.Element && !this.owned(node) && !["html", "body", "script", "style", "link", "meta", "head", "template"].includes(node.localName)
        && node.isConnected && node.getBoundingClientRect().width > 0 && node.getBoundingClientRect().height > 0;
    }

    startAnnotation(draft) {
      if (this.destroyed || this.busy) return;
      this.saveDraft();
      this.cancelCapture();
      this.screenshot = null;
      this.annotationDraft = draft || this.drafts.annotation;
      if (this.dialog.open) this.dialog.close();
      this.selected = null;
      this.highlight.hidden = true;
      this.expand(false);
      this.picking = true;
      this.picker.hidden = false;
      this.root.classList.add("uinotate-picking");
      this.live.textContent = "Selection mode. Click an element, or Tab to it and press Enter. Press Escape to cancel.";
      // Reset sequential keyboard navigation to the beginning of the page.
      // Restore the host's tabindex immediately; no persistent host attributes are added.
      const bodyTabIndex = document.body.getAttribute("tabindex");
      document.body.setAttribute("tabindex", "-1");
      document.body.focus({ preventScroll: true });
      if (bodyTabIndex === null) document.body.removeAttribute("tabindex");
      else document.body.setAttribute("tabindex", bodyTabIndex);
    }

    stopAnnotation(restoreFocus = false) {
      this.picking = false;
      this.picker.hidden = true;
      this.highlight.hidden = true;
      this.root.classList.remove("uinotate-picking");
      this.live.textContent = "";
      if (restoreFocus) {
        this.live.textContent = "Element selection cancelled.";
        this.launcher.focus({ preventScroll: true });
        this.expand(false);
      }
    }

    preview(node) {
      if (!this.eligible(node)) { this.selected = null; this.highlight.hidden = true; return; }
      this.selected = node;
      this.drawHighlight(node);
    }

    drawHighlight(node) {
      if (!node.isConnected) { this.highlight.hidden = true; return; }
      const rect = node.getBoundingClientRect();
      Object.assign(this.highlight.style, { left: rect.left + "px", top: rect.top + "px", width: rect.width + "px", height: rect.height + "px" });
      this.highlightLabel.textContent = node.localName + (node.id ? "#" + node.id : "") + " · " + Math.round(rect.width) + " × " + Math.round(rect.height);
      this.highlightLabel.classList.toggle("uinotate-highlight-label--below", rect.top < 36);
      this.highlight.hidden = false;
    }

    select(node) {
      const draft = this.annotationDraft || this.drafts.annotation;
      this.stopAnnotation(false);
      this.selected = node;
      this.cancelCapture();
      this.screenshot = this.config.captureScreenshot ? { status: "pending", include: true } : null;
      this.annotationContext = this.elementContext(node);
      this.drawHighlight(node);
      this.renderForm("annotation", draft.message, draft.category);
      if (this.config.captureScreenshot) this.captureSelection();
    }

    renderScreenshot() {
      const box = this.screenshotBox = element("div", "uinotate-screenshot");
      const header = element("div", "uinotate-screenshot-header");
      const label = element("label", "uinotate-screenshot-toggle");
      const toggle = this.screenshotToggle = element("input");
      toggle.type = "checkbox";
      toggle.checked = true;
      label.append(toggle, document.createTextNode("Attach element screenshot"));
      const retake = this.retakeButton = element("button", "uinotate-text-button", "Retake");
      retake.type = "button";
      header.append(label, retake);
      const preview = this.screenshotPreview = element("img", "uinotate-screenshot-preview");
      preview.alt = "Screenshot preview of the selected element";
      preview.hidden = true;
      const status = this.screenshotStatus = element("p", "uinotate-screenshot-status");
      status.setAttribute("role", "status");
      status.setAttribute("aria-live", "polite");
      box.append(header, preview, status);
      this.content.append(box);
      this.listenView(toggle, "change", () => {
        if (this.screenshot) this.screenshot.include = toggle.checked;
        this.updateScreenshotView();
      });
      this.listenView(retake, "click", () => this.captureSelection());
    }

    updateScreenshotView() {
      if (this.currentType !== "annotation" || !this.screenshotBox?.isConnected) return;
      const state = this.screenshot;
      this.screenshotBox.hidden = !this.config.captureScreenshot;
      this.screenshotToggle.checked = Boolean(state?.include);
      this.screenshotToggle.disabled = this.busy || state?.status === "excluded" || state?.status === "error";
      this.retakeButton.disabled = this.busy || state?.status === "pending" || state?.status === "excluded";
      this.screenshotPreview.hidden = state?.status !== "ready" || !state.include;
      if (state?.status === "ready") {
        const shot = state.attachment;
        this.screenshotPreview.src = shot.dataUrl;
        this.screenshotStatus.textContent = state.include ? "PNG · " + shot.width + " × " + shot.height + " · " + Math.max(1, Math.ceil(shot.byteLength / 1024)) + " KB. Check the preview before sending." : "Screenshot left out of this annotation.";
      } else if (state?.status === "error" || state?.status === "excluded") {
        this.screenshotPreview.removeAttribute("src");
        this.screenshotStatus.textContent = state.error + " You can still send your annotation.";
      } else this.screenshotStatus.textContent = state?.include ? "Capturing selected element…" : "Screenshot left out of this annotation.";
      if (this.submitButton?.isConnected) this.submitButton.disabled = this.busy || Boolean(state?.status === "pending" && state.include);
    }

    cancelCapture() {
      this.captureRevision++;
      this.captureController?.abort();
      this.captureController = null;
      this.capturePromise = null;
    }

    captureSelection() {
      if (this.destroyed || this.busy || !this.selected || !this.config.captureScreenshot) return Promise.resolve();
      this.cancelCapture();
      const revision = this.captureRevision;
      const node = this.selected;
      const config = this.config;
      if (!canCapture(node)) {
        this.screenshot = { status: "excluded", include: false, error: "Screenshot excluded for form fields, editable content, iframes, or private elements." };
        this.updateScreenshotView();
        return Promise.resolve();
      }
      this.annotationContext = this.elementContext(node);
      this.screenshot = { status: "pending", include: true };
      this.updateScreenshotView();
      const controller = new AbortController();
      this.captureController = controller;
      let timer;
      let onAbort;
      this.capturePromise = (async () => {
        try {
          const cancelled = new Promise((resolve, reject) => {
            onAbort = () => reject(new Error("Screenshot capture was interrupted."));
            controller.signal.addEventListener("abort", onAbort, { once: true });
          });
          const deadline = new Promise((resolve, reject) => {
            timer = global.setTimeout(() => {
              reject(new Error("Screenshot capture took too long."));
              controller.abort();
            }, config.screenshotTimeout);
          });
          const attachment = await Promise.race([captureElement(node, config, { signal: controller.signal }, config.screenshotRenderer || undefined), deadline, cancelled]);
          if (this.destroyed || revision !== this.captureRevision) return;
          this.screenshot = { status: "ready", include: this.screenshot.include, attachment };
        } catch (error) {
          if (this.destroyed || revision !== this.captureRevision) return;
          this.screenshot = { status: "error", include: false, error: "Couldn’t capture this element. Try Retake or leave the screenshot out." };
        } finally {
          global.clearTimeout(timer);
          if (onAbort) controller.signal.removeEventListener("abort", onAbort);
          if (!this.destroyed && revision === this.captureRevision) {
            this.captureController = null;
            this.updateScreenshotView();
          }
        }
      })();
      return this.capturePromise;
    }

    elementContext(node) {
      const target = {
        selector: selectorFor(node), tagName: node.localName,
        id: node.id || null, classes: Array.from(node.classList), rect: rectFor(node)
      };
      if (this.config.collectStyles) {
        const style = global.getComputedStyle(node);
        target.styles = Object.fromEntries(STYLE_PROPERTIES.map((key) => [key, style.getPropertyValue(key)]));
      }
      if (this.config.includeElementText && !node.closest("input, textarea, select, [contenteditable]:not([contenteditable='false'])")
        && !node.querySelector("input, textarea, select, [contenteditable]:not([contenteditable='false'])")) {
        target.text = (node.textContent || "").replace(/\s+/g, " ").trim().slice(0, 300);
      }
      return target;
    }

    payload(type) {
      const payload = {
        schemaVersion: 1,
        id: global.crypto && global.crypto.randomUUID ? global.crypto.randomUUID() : "uinotate-" + Date.now() + "-" + Math.random().toString(36).slice(2),
        type, message: this.textarea.value.trim(),
        category: type === "annotation" ? this.category.value : "general",
        createdAt: new Date().toISOString(),
        page: {
          url: global.location.origin + global.location.pathname,
          title: document.title,
          viewport: { width: global.innerWidth, height: global.innerHeight, devicePixelRatio: global.devicePixelRatio },
          scroll: { x: global.scrollX, y: global.scrollY }
        },
        metadata: JSON.parse(JSON.stringify(this.config.metadata))
      };
      if (type === "annotation") {
        if (!this.selected || !this.selected.isConnected) throw new Error("That element is no longer on the page. Please select it again.");
        const target = payload.element = JSON.parse(JSON.stringify(this.annotationContext || this.elementContext(this.selected)));
        if (this.config.captureScreenshot && this.screenshot?.include && this.screenshot.status === "ready") target.screenshot = { ...this.screenshot.attachment };
      }
      return payload;
    }

    async submit(type) {
      if (this.busy || this.destroyed) return;
      if (type === "annotation" && this.screenshot?.include && this.screenshot.status === "pending") {
        await this.capturePromise;
        if (this.busy || this.destroyed || this.currentType !== "annotation") return;
      }
      const submitConfig = this.config;
      this.busy = true;
      this.closeButton.disabled = true;
      this.dialog.setAttribute("aria-busy", "true");
      this.submitButton.disabled = true;
      this.textarea.disabled = true;
      if (type === "annotation") this.category.disabled = true;
      if (type === "annotation") {
        this.changeTargetButton.disabled = true;
        this.updateScreenshotView();
      }
      this.submitButton.replaceChildren(element("span", "uinotate-spinner"), document.createTextNode("Sending…"));
      this.status.hidden = true;
      const controller = new AbortController();
      this.request = controller;
      let timedOut = false;
      let timeout;
      let abortHandler;
      try {
        const payload = this.payload(type);
        const operation = (async () => {
          if (submitConfig.onSubmit) return await submitConfig.onSubmit(payload, { signal: controller.signal });
          if (!submitConfig.apiUrl) throw new Error("Feedback isn’t connected yet. Please configure apiUrl or onSubmit.");
          const headers = new Headers(submitConfig.headers);
          headers.set("Content-Type", "application/json");
          const token = typeof submitConfig.token === "function" ? await submitConfig.token() : submitConfig.token;
          if (controller.signal.aborted) throw new DOMException("Aborted", "AbortError");
          if (token) headers.set("Authorization", "Bearer " + token);
          const response = await global.fetch(submitConfig.apiUrl, {
            method: "POST", headers, body: JSON.stringify(payload), signal: controller.signal,
            credentials: "omit", referrerPolicy: "no-referrer"
          });
          if (!response.ok) throw new Error("The feedback service returned HTTP " + response.status + ". Please try again.");
          return response;
        })();
        // The timeout also covers async token providers and application callbacks.
        const deadline = new Promise((resolve, reject) => {
          timeout = global.setTimeout(() => {
            timedOut = true;
            controller.abort();
            reject(new Error("Sending took too long. Your message is still here; please try again."));
          }, submitConfig.requestTimeout);
        });
        const cancelled = new Promise((resolve, reject) => {
          abortHandler = () => reject(new DOMException("Aborted", "AbortError"));
          if (controller.signal.aborted) abortHandler();
          else controller.signal.addEventListener("abort", abortHandler, { once: true });
        });
        const result = await Promise.race([operation, deadline, cancelled]);
        if (this.destroyed) return;
        this.drafts[type] = { message: "", category: "style" };
        this.renderSuccess();
        this.dispatch("success", { payload, result });
        this.notify(submitConfig.onSuccess, payload, result);
      } catch (error) {
        if (this.destroyed) return;
        const message = timedOut ? "Sending took too long. Your message is still here; please try again." :
          error instanceof TypeError ? "Couldn’t reach the feedback service. Check your connection and try again." : (error.message || "Couldn’t send your feedback. Please try again.");
        this.status.textContent = message;
        this.status.hidden = false;
        this.status.setAttribute("role", "alert");
        this.dispatch("error", { error });
        this.notify(submitConfig.onError, error);
      } finally {
        global.clearTimeout(timeout);
        if (abortHandler) controller.signal.removeEventListener("abort", abortHandler);
        this.request = null;
        this.busy = false;
        this.closeButton.disabled = false;
        this.dialog.removeAttribute("aria-busy");
        if (!this.destroyed && this.textarea.isConnected) {
          this.textarea.disabled = false;
          if (type === "annotation") this.category.disabled = false;
          if (type === "annotation") this.changeTargetButton.disabled = false;
          this.submitButton.disabled = false;
          this.submitButton.replaceChildren(document.createTextNode("Send " + (type === "annotation" ? "annotation" : "feedback")), icon("arrow"));
          if (!this.status.hidden) this.textarea.focus({ preventScroll: true });
          if (type === "annotation") this.updateScreenshotView();
        }
      }
    }

    renderSuccess() {
      this.cancelCapture();
      this.screenshot = null;
      this.highlight.hidden = true;
      this.clearView();
      this.currentType = null;
      const mark = element("div", "uinotate-success-mark");
      mark.append(icon("check"));
      this.content.append(mark);
      this.heading("Thanks for the nudge.", "Your feedback has been sent. Little details make a big difference.");
      const done = element("button", "uinotate-primary-button uinotate-done", "Back to the page");
      done.type = "button";
      this.listenView(done, "click", () => this.closeDialog());
      this.content.append(done);
      done.focus({ preventScroll: true });
    }

    notify(callback, ...args) {
      if (!callback) return;
      // A consumer callback must not turn an accepted submission into a failed one.
      try { Promise.resolve(callback(...args)).catch((error) => global.console.error("Uinotate callback failed:", error)); }
      catch (error) { global.console.error("Uinotate callback failed:", error); }
    }

    dispatch(name, detail) {
      this.root.dispatchEvent(new CustomEvent("uinotate:" + name, { detail, bubbles: true }));
    }

    destroy() {
      if (this.destroyed) return;
      this.destroyed = true;
      global.clearTimeout(this.closeTimer);
      if (this.request) this.request.abort();
      this.cancelCapture();
      this.listeners.splice(0).forEach((remove) => remove());
      this.viewListeners.splice(0).forEach((remove) => remove());
      if (this.dialog.open) this.dialog.close();
      this.nodes.forEach((node) => node.remove());
      if (active === this) active = null;
    }
  }

  const api = {
    version: VERSION,
    init(options = {}) {
      if (!document.body) throw new Error("Uinotate: call init after the body exists, or load lib.js with defer.");
      normalize(options); // Validate before replacing a working instance.
      if (active) active.destroy();
      active = new Widget(options);
      return active;
    },
    destroy() { if (active) active.destroy(); },
    get instance() { return active; }
  };
  global.Uinotate = api;
  const script = document.currentScript;
  if (script && script.hasAttribute("data-uinotate-auto") && script.dataset.uinotateAuto !== "false") {
    const start = () => {
      if (active) return;
      const options = Object.assign({}, global.UinotateConfig || {});
      if (script.dataset.position) options.position = script.dataset.position;
      if (script.dataset.offset) options.offset = script.dataset.offset;
      if (script.dataset.endpoint) options.apiUrl = script.dataset.endpoint;
      api.init(options);
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
    else start();
  }
})(window);
