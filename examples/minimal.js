const widget = Uinotate.init({
  position: "left",
  offset: "55%",
  metadata: { example: "minimal" },
  onSubmit: async (payload, { signal }) => {
    if (signal.aborted) throw new DOMException("Aborted", "AbortError");
    const display = JSON.parse(JSON.stringify(payload));
    if (display.element?.screenshot) display.element.screenshot.dataUrl = "data:image/png;base64,… (shortened in this preview)";
    document.getElementById("received").textContent = JSON.stringify(display, null, 2);
  }
});
document.getElementById("example-button").addEventListener("click", () => widget.openFeedback());
