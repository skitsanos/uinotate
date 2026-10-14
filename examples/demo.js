"use strict";

const themes = {
  iris: {},
  forest: { "--uinotate-accent": "#287465", "--uinotate-accent-hover": "#1f5c50", "--uinotate-soft": "#f0f7f3" },
  ink: { "--uinotate-accent": "#292d3a", "--uinotate-accent-hover": "#171a24", "--uinotate-soft": "#f2f3f5", "--uinotate-radius": "8px" }
};
let count = 0;
const widget = Uinotate.init({
  apiUrl: "/api/feedback",
  token: () => "uinotate-demo-token",
  metadata: { project: "uinotate-playground", environment: "demo" },
  onSuccess(payload) {
    count++;
    document.getElementById("empty-payload").hidden = true;
    const output = document.getElementById("payload-output");
    output.hidden = false;
    const display = JSON.parse(JSON.stringify(payload));
    const shot = payload.element?.screenshot;
    const preview = document.getElementById("submitted-screenshot");
    preview.hidden = !shot;
    if (shot) {
      preview.src = shot.dataUrl;
      display.element.screenshot.dataUrl = "data:image/png;base64,… (" + shot.dataUrl.length + " characters; shortened in this preview)";
    } else preview.removeAttribute("src");
    output.textContent = JSON.stringify(display, null, 2);
    document.getElementById("payload-badge").textContent = "RECEIVED";
    document.getElementById("payload-badge").classList.add("received");
    document.getElementById("submission-status").textContent = count + " " + (count === 1 ? "nudge" : "nudges") + " received this session. Nothing stored.";
  }
});

document.getElementById("try-feedback").addEventListener("click", () => widget.openFeedback());
document.getElementById("open-feedback").addEventListener("click", () => widget.openFeedback());
document.getElementById("try-annotation").addEventListener("click", () => widget.startAnnotation());
document.getElementById("edge-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-edge]");
  if (!button) return;
  widget.update({ position: button.dataset.edge });
  document.querySelectorAll("[data-edge]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
});
document.getElementById("offset").addEventListener("input", (event) => {
  const offset = event.target.value + "%";
  widget.update({ offset });
  document.getElementById("offset-value").textContent = offset;
});
document.querySelector(".theme-controls").addEventListener("click", (event) => {
  const button = event.target.closest("button[data-theme]");
  if (!button) return;
  widget.update({ theme: themes[button.dataset.theme] });
  document.querySelectorAll("[data-theme]").forEach((item) => item.setAttribute("aria-pressed", String(item === button)));
});
document.getElementById("simulate-failure").addEventListener("change", (event) => {
  widget.update({ headers: event.target.checked ? { "X-Demo-Fail": "true" } : {} });
});
document.getElementById("sample-button").addEventListener("click", () => {
  document.querySelector(".sample-bottom p").textContent = "Just a demo button. Try annotating it!";
});
