const $ = (selector) => document.querySelector(selector);
const categories = { general: "General", style: "Visual style", layout: "Layout", content: "Content", interaction: "Interaction", other: "Other" };
const state = { key: "", page: 1, selected: null, listRequest: null, detailRequest: null };
const date = value => new Date(value).toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
function node(tag, className, text) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (text !== undefined) el.textContent = text;
  return el;
}
function styleFilter(select) {
  const root = node("div", "filter-select"), trigger = node("button", "filter-select-trigger");
  root.dataset.filter = select.id;
  const label = select.labels[0], value = node("span", "filter-select-value"), popup = node("div", "filter-select-popup");
  trigger.type = "button"; trigger.id = select.id + "-trigger";
  label.id ||= select.id + "-label"; label.htmlFor = trigger.id;
  trigger.setAttribute("role", "combobox"); trigger.setAttribute("aria-labelledby", label.id);
  trigger.setAttribute("aria-haspopup", "listbox"); trigger.setAttribute("aria-expanded", "false");
  popup.id = select.id + "-options"; popup.hidden = true;
  popup.setAttribute("role", "listbox"); popup.setAttribute("aria-labelledby", label.id);
  trigger.setAttribute("aria-controls", popup.id);
  const chevron = node("span", "filter-select-chevron"); chevron.setAttribute("aria-hidden", "true");
  trigger.append(value, chevron);
  const choices = Array.from(select.options);
  let active = select.selectedIndex, typed = "", lastTyped = 0;
  const options = choices.map((choice, index) => {
    const option = node("div", "filter-select-option", choice.textContent);
    option.id = select.id + "-option-" + index; option.setAttribute("role", "option");
    option.addEventListener("pointerdown", event => event.preventDefault());
    option.addEventListener("pointermove", () => highlight(index));
    option.addEventListener("click", () => { active = index; commit(); trigger.focus(); });
    popup.append(option); return option;
  });
  function sync() {
    value.textContent = choices[select.selectedIndex].textContent;
    options.forEach((option, index) => option.setAttribute("aria-selected", String(index === select.selectedIndex)));
  }
  function highlight(index) {
    active = Math.max(0, Math.min(index, options.length - 1));
    options.forEach((option, i) => option.classList.toggle("is-active", i === active));
    trigger.setAttribute("aria-activedescendant", options[active].id);
    options[active].scrollIntoView({ block: "nearest" });
  }
  function open() {
    if (!popup.hidden) return;
    typed = ""; popup.hidden = false; trigger.setAttribute("aria-expanded", "true");
    const bounds = root.getBoundingClientRect(), spaceBelow = innerHeight - bounds.bottom;
    root.classList.toggle("opens-up", spaceBelow < popup.offsetHeight + 8 && bounds.top > spaceBelow);
    highlight(select.selectedIndex);
  }
  function close() { popup.hidden = true; trigger.setAttribute("aria-expanded", "false"); trigger.removeAttribute("aria-activedescendant"); root.classList.remove("opens-up"); }
  function commit() {
    const changed = select.selectedIndex !== active;
    select.selectedIndex = active; sync(); close();
    if (changed) select.dispatchEvent(new Event("change", { bubbles: true }));
  }
  trigger.addEventListener("click", () => popup.hidden ? open() : close());
  trigger.addEventListener("keydown", event => {
    if (event.key === "Tab") { if (!popup.hidden) commit(); return; }
    if (event.key === "Escape") { if (!popup.hidden) { event.preventDefault(); close(); } return; }
    if (["Enter", " "].includes(event.key)) { event.preventDefault(); popup.hidden ? open() : commit(); return; }
    if (["ArrowDown", "ArrowUp", "Home", "End", "PageDown", "PageUp"].includes(event.key)) {
      event.preventDefault();
      const wasOpen = !popup.hidden; open();
      if (event.altKey && event.key === "ArrowUp") { commit(); return; }
      if (event.key === "Home") highlight(0);
      else if (event.key === "End") highlight(options.length - 1);
      else if (wasOpen) highlight(active + ({ ArrowDown: 1, ArrowUp: -1, PageDown: 10, PageUp: -10 }[event.key]));
      return;
    }
    if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault(); open();
      const now = Date.now(); typed = now - lastTyped < 700 ? typed + event.key.toLowerCase() : event.key.toLowerCase(); lastTyped = now;
      const repeated = Array.from(typed).every(char => char === typed[0]);
      const search = repeated ? typed[0] : typed;
      for (let step = 0; step < choices.length; step++) {
        const index = (active + (search.length === 1 ? 1 : 0) + step) % choices.length;
        if (choices[index].textContent.toLowerCase().startsWith(search)) { highlight(index); break; }
      }
    }
  });
  document.addEventListener("pointerdown", event => { if (!root.contains(event.target)) close(); });
  root.addEventListener("focusout", event => { if (!root.contains(event.relatedTarget)) close(); });
  window.addEventListener("resize", close);
  select.addEventListener("change", sync);
  select.hidden = true; root.append(trigger, popup); select.after(root); sync();
}
function notice(message = "") { $("#notice").textContent = message; $("#notice").hidden = !message; }
function lock() {
  state.key = ""; state.selected = null; state.page = 1;
  state.listRequest?.abort(); state.detailRequest?.abort();
  $("#access-key").value = ""; $("#inbox").hidden = true; $("#access").hidden = false; $("#lock").hidden = true;
  $("#records").replaceChildren(); $("#detail").replaceChildren();
}
async function request(url, signal) {
  const response = await fetch(url, { headers: { Authorization: "Bearer " + state.key }, cache: "no-store", credentials: "omit", signal });
  if (response.status === 401) { lock(); throw new Error("The dashboard access key was not accepted. Enter a viewing key to open the inbox."); }
  if (!response.ok) throw new Error("The inbox could not be loaded. Please try again.");
  return response.json();
}
function detailsBlock(title, value) {
  const block = node("details"); block.append(node("summary", "", title), node("pre", "", JSON.stringify(value, null, 2))); return block;
}
function fields(items) {
  const dl = node("dl");
  for (const [key, value] of items) dl.append(node("dt", "", key), node("dd", "", value));
  return dl;
}
function emptyDetail() {
  const div = node("div", "detail-empty"); div.append(node("h2", "", "A little context goes a long way."), node("p", "muted", "Select a nudge to see the details.")); $("#detail").replaceChildren(div);
}
async function selectRecord(id, button) {
  state.detailRequest?.abort();
  state.detailRequest = new AbortController();
  const signal = state.detailRequest.signal;
  state.selected = id;
  for (const el of $("#records").querySelectorAll("button")) el.setAttribute("aria-pressed", String(el.dataset.id === id));
  $("#detail").setAttribute("aria-busy", "true");
  try {
    const record = await request("/api/records/" + encodeURIComponent(id), signal);
    if (signal.aborted) return;
    renderDetail(record);
    if (button && matchMedia("(max-width: 650px)").matches) $("#detail").scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "instant" : "smooth", block: "start" });
  } catch (error) { if (error.name !== "AbortError") notice(error.message); }
  finally { if (!signal.aborted) $("#detail").removeAttribute("aria-busy"); }
}
function renderDetail({ id, receivedAt, payload }) {
  const header = node("div", "detail-header"), badges = node("div");
  badges.append(node("span", "badge " + payload.type, payload.type === "annotation" ? "↗ Annotation" : "◌ Quick feedback"), node("span", "fine", categories[payload.category]));
  header.append(badges, node("span", "fine", "Received " + date(receivedAt)));
  const content = node("div", "detail-content");
  content.append(node("h3", "", "The note"), node("p", "note-message", payload.message));
  const page = node("div", "section"); page.append(node("h3", "", "Page context"));
  page.append(fields([["Page", payload.page.title || "Untitled page"], ["Location", payload.page.url], ["Viewport", `${payload.page.viewport.width} × ${payload.page.viewport.height} CSS px · ${payload.page.viewport.devicePixelRatio}× DPR`]]));
  const target = payload.element;
  if (target) {
    const section = node("div", "section"); section.append(node("h3", "", "Selected element"));
    section.append(fields([["Selector", target.selector], ["Element", target.tagName + (target.id ? " · #" + target.id : "")], ["Classes", target.classes.join(" ") || "None"], ["Bounds", `${target.rect.width} × ${target.rect.height} CSS px · x ${target.rect.x}, y ${target.rect.y}`]]));
    if (target.text !== undefined) section.append(detailsBlock("Element text excerpt", target.text));
    if (target.styles) section.append(detailsBlock("Computed styles", target.styles));
    const imageSection = node("div", "section"); imageSection.append(node("h3", "", "Element screenshot"));
    if (target.screenshot) {
      const shot = target.screenshot, frame = node("div", "screenshot-frame"), img = node("img");
      img.alt = "Attached screenshot of " + target.selector; img.src = shot.dataUrl;
      frame.append(img); imageSection.append(frame, node("p", "fine image-caption", `PNG · ${shot.width} × ${shot.height} px · ${(shot.byteLength / 1024).toFixed(1)} KB · captured ${date(shot.capturedAt)}`));
    } else imageSection.append(node("p", "muted", "No screenshot was attached to this annotation."));
    content.append(imageSection, section);
  }
  content.append(page);
  const info = node("div", "section"); info.append(node("h3", "", "Submission details"), fields([["Received", new Date(receivedAt).toISOString()], ["Client time", payload.createdAt], ["Record ID", id], ["Client ID", payload.id]]), detailsBlock("Application metadata", payload.metadata));
  const preview = structuredClone(payload);
  if (preview.element?.screenshot) preview.element.screenshot.dataUrl = "data:image/png;base64,… (shortened in this preview)";
  info.append(detailsBlock("Payload JSON · image data shortened", preview)); content.append(info);
  $("#detail").replaceChildren(header, content);
}
async function load() {
  state.listRequest?.abort(); state.detailRequest?.abort();
  state.listRequest = new AbortController(); const signal = state.listRequest.signal;
  const query = new URLSearchParams({ page: state.page, type: $("#type").value, category: $("#category").value, q: $("#search").value.trim() });
  $("#records").setAttribute("aria-busy", "true"); notice();
  try {
    const data = await request("/api/records?" + query, signal);
    if (signal.aborted) return;
    if (data.page > 1 && !data.records.length) { state.page = 1; return load(); }
    $("#access").hidden = true; $("#inbox").hidden = false; $("#lock").hidden = false; $("#access-key").value = "";
    for (const key of ["total", "feedback", "annotations", "screenshots"]) $("#count-" + key).textContent = data.stats[key];
    $("#result-count").textContent = data.total + (data.total === 1 ? " nudge" : " nudges");
    const rows = data.records.map(record => {
      const button = node("button", "record"); button.type = "button"; button.dataset.id = record.id; button.setAttribute("aria-pressed", String(record.id === state.selected));
      const top = node("div", "record-top"); top.append(node("span", "badge " + record.type, record.type === "annotation" ? "↗ Annotation" : "◌ Feedback"), node("span", "fine", categories[record.category]));
      const bottom = node("div", "record-bottom"); bottom.append(node("code", "", record.selector || "Page feedback"), node("span", "", record.hasScreenshot ? "▧ PNG" : date(record.receivedAt)));
      button.append(top, node("p", "message", record.message), node("p", "record-page", record.pageTitle || record.pageUrl), bottom);
      button.addEventListener("click", () => selectRecord(record.id, button)); return button;
    });
    if (!rows.length) {
      const empty = node("div", "empty-list"); empty.append(node("h2", "", data.stats.total ? "No matching nudges." : "Room for the first nudge."), node("p", "muted", data.stats.total ? "Try a different search or filter." : "Send feedback from the widget test page to get started.")); rows.push(empty);
    }
    $("#records").replaceChildren(...rows);
    $("#page-label").textContent = `Page ${data.page} of ${Math.max(1, Math.ceil(data.total / data.pageSize))}`;
    $("#previous").disabled = data.page <= 1; $("#next").disabled = data.page * data.pageSize >= data.total;
    if (!data.records.some(record => record.id === state.selected)) { state.selected = null; emptyDetail(); }
    else await selectRecord(state.selected);
  } catch (error) { if (error.name !== "AbortError") notice(error.message); }
  finally { if (!signal.aborted) $("#records").removeAttribute("aria-busy"); }
}
for (const select of document.querySelectorAll(".filters select")) styleFilter(select);
$("#login").addEventListener("submit", event => { event.preventDefault(); state.key = $("#access-key").value.trim(); state.page = 1; load(); });
$("#lock").addEventListener("click", () => { lock(); notice(); $("#access-key").focus(); });
$("#filters").addEventListener("submit", event => { event.preventDefault(); state.page = 1; load(); });
for (const id of ["#type", "#category"]) $(id).addEventListener("change", () => { state.page = 1; load(); });
let searchTimer;
$("#search").addEventListener("input", () => { clearTimeout(searchTimer); searchTimer = setTimeout(() => { if (state.key) { state.page = 1; load(); } }, 250); });
$("#refresh").addEventListener("click", load);
$("#previous").addEventListener("click", () => { state.page--; load(); });
$("#next").addEventListener("click", () => { state.page++; load(); });
