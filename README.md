# Uinotate

A standalone JavaScript widget for quick feedback and DOM element annotations, with PNG screenshots of selected elements. Include `lib.js` and `uinotate.css` on an HTML page or in a web app. The screenshot renderer is bundled in `lib.js`; embedding pages need no extra scripts or build step.

The launcher peeks out from a configurable edge. Hover, focus, or tap it to reveal an animated arc with **Quick feedback**, **Annotate**, and **About** buttons. Feedback opens a small modal. Annotation mode lets a user select a visible element, review its screenshot, and write a note about its style, layout, content, or interaction. The screenshot can be retaken or left out before sending.

**Live examples:** [Playground](https://uinotate.netlify.app/examples/) · [Minimal integration](https://uinotate.netlify.app/examples/minimal.html)

[![Deploy to Netlify](https://www.netlify.com/img/deploy/button.svg)](https://app.netlify.com/start/deploy?repository=https://github.com/skitsanos/uinotate&fullConfiguration=true)

Deploy your own copy of the demo with the button above. During setup, enter a unique `UINOTATE_DEMO_SIGNING_SECRET` of at least 32 characters; generate one locally with `openssl rand -hex 32`. Netlify reads the build and function settings from `netlify.toml`.

See [Netlify deployment](docs/netlify-deployment.md) for a complete static-site and serverless API example, including signed demo sessions, body limits, rate limits, and deployment commands. The public demo validates feedback and discards it; it does not store submitted messages or screenshots.

## Features

- Quick feedback about the current page.
- DOM element annotations with a selector, dimensions, computed styles, and an optional PNG screenshot.
- Animated arc controls on any of the four page edges, with mouse, keyboard, and tap support.
- Custom colors, typography, spacing, and modal styles through CSS variables and scoped selectors.
- JSON POST submission with Bearer authentication, refreshed token providers, or your own application callback.
- In-memory drafts, retryable errors, request timeouts, and cleanup for application lifecycle changes.

## Project structure

```text
lib.js                 Distributable browser bundle, including screenshot rendering
uinotate.css           Distributable widget styles
src/widget.js          Widget implementation and public API
src/screenshot.js      Element capture, privacy filters, and image size limits
scripts/build.js       Bun build that generates lib.js
scripts/build-site.js  Allowlisted static demo build for Netlify
netlify.toml           Build, headers, redirects, and local runtime configuration
netlify/functions/     Session and feedback HTTP functions
netlify/lib/           Shared validation and session signing code
docs/                  Deployment guide
examples/              Playground, minimal integration, and local demo server
tests/                 Widget, screenshot, and demo server tests
bun.lock               Locked development dependencies
```

Deploy `lib.js` and `uinotate.css` together to your website's static asset directory. The `src`, `scripts`, `tests`, and `node_modules` directories are only needed to develop the widget. Load the bundle with a script tag to access `window.Uinotate`; each HTML document has its own instance.

## Try the examples

```sh
git clone https://github.com/skitsanos/uinotate.git
cd uinotate
bun install
bun run dev
```

Open [the playground](http://127.0.0.1:4173/examples/). It includes live edge/offset/theme controls, a JSON inspector, and an authenticated local demonstration endpoint. Enable “Simulate a failed request” to test the error state; close the dialog, disable the simulation, and reopen feedback to retry the retained draft.

- `examples/index.html`: full interactive playground using JSON POST and Bearer authentication.
- `examples/minimal.html`: a minimal callback integration and CSS theme overrides; also works when opened directly from disk.

The demo server listens on `127.0.0.1:4173`. Override the port with `UINOTATE_DEMO_PORT=4300 bun run dev`. It acknowledges and discards submissions; it does not store feedback. It is a development example, not a production feedback backend.

The playground fetches a signed, 15-minute session from `/api/demo-session`, then sends it as the Bearer token on `/api/feedback`. The local server generates a temporary signing key at startup. For Netlify's local headers, redirects, and function runtime, use `bun run dev:netlify` and open `http://localhost:8888/examples/`.

## Include it in a page

Put the stylesheet after your application's CSS. Initialize after the body exists:

```html
<link rel="stylesheet" href="/widgets/uinotate.css">

<!-- Near the end of <body> -->
<script src="/widgets/lib.js"></script>
<script>
  const feedback = Uinotate.init({
    position: 'right',
    offset: '50%',
    apiUrl: 'https://feedback.example.com/v1/feedback',
    token: async () => getFeedbackToken(),
    metadata: { project: 'my-app', release: '2026.10' }
  });
</script>
```

`getFeedbackToken()` represents your application's token provider. Return the token only, without the `Bearer ` prefix. A function is called on each submission, so refreshed session tokens can be used. A token string is also accepted. Use a token scoped to feedback submission; JavaScript and its configuration are visible to page users.

For a deferred script, initialize from a later deferred application script or `DOMContentLoaded`. Each document has one active instance; a successful call to `init()` replaces and destroys the previous instance. Invalid configuration leaves the previous instance intact.

### Automatic initialization

Define optional configuration before the script and add `data-uinotate-auto`:

```html
<link rel="stylesheet" href="/widgets/uinotate.css">
<script>
  window.UinotateConfig = {
    token: () => getFeedbackToken(),
    metadata: { project: 'my-app' }
  };
</script>
<script src="/widgets/lib.js" defer
        data-uinotate-auto
        data-position="bottom"
        data-offset="70%"
        data-endpoint="https://feedback.example.com/v1/feedback"></script>
```

Script attributes override the corresponding `UinotateConfig` options. Without `data-uinotate-auto`, loading the script only exposes `window.Uinotate`. An explicit instance initialized before the automatic startup takes precedence.

## Configuration

| Option | Default | Purpose |
| --- | --- | --- |
| `position` | `'right'` | `'right'`, `'left'`, `'top'`, or `'bottom'`. |
| `offset` | `'50%'` | Position along the edge, measured from its top or left. CSS length/percentage or a number in pixels. Clamped away from corners to keep the arc reachable. |
| `apiUrl` | `null` | Absolute or relative HTTP(S) URL accepting JSON POST. |
| `token` | `null` | Token string or sync/async function returning a token. |
| `headers` | `{}` | Extra request headers. JSON content type and a configured token take precedence. |
| `metadata` | `{}` | JSON-serializable application context copied into each payload. |
| `theme` | `{}` | CSS variable overrides, with full `--uinotate-*` names. |
| `title` | `'A little feedback goes a long way.'` | Quick feedback modal heading. |
| `zIndex` | `2147483000` | Base stacking order for the dock and selection UI. Dialogs use the browser's top layer. |
| `maxLength` | `5000` | Maximum feedback message length. |
| `requestTimeout` | `15000` | Milliseconds allowed for sending, including token resolution or an app callback. |
| `collectStyles` | `true` | Include relevant computed CSS properties in annotations. |
| `includeElementText` | `false` | Opt in to a 300-character element text excerpt. Input values and editable/form subtrees are excluded. |
| `captureScreenshot` | `true` | Capture a PNG when an element is selected. Only annotations include screenshots. |
| `screenshotMaxDimension` | `1200` | Maximum width or height of the PNG in pixels (32–4096). Aspect ratio is preserved. |
| `screenshotMaxBytes` | `300000` | Maximum PNG byte size before base64 encoding (1024–2000000). Larger images are downscaled. |
| `screenshotTimeout` | `8000` | Milliseconds allowed for capture. A failed or timed-out capture leaves annotation sending available. |
| `screenshotRenderer` | `null` | Optional adapter `(element, options) => Promise<HTMLCanvasElement>`. The default bundled renderer works without this. |
| `onSubmit` | `null` | Custom transport: `(payload, { signal }) => Promise`. Takes precedence over `apiUrl`. |
| `onSuccess` | `null` | Notification after acceptance: `(payload, result) => void`. |
| `onError` | `null` | Notification after failure: `(error) => void`. |

### Use your own application transport

```js
const feedback = Uinotate.init({
  onSubmit: async (payload, { signal }) => {
    const response = await fetch('/my-feedback-route', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal
    });
    if (!response.ok) throw new Error('Could not save feedback. Please try again.');
    return response;
  },
  onSuccess: (payload) => console.log('Feedback accepted:', payload.id)
});
```

A resolved `onSubmit` promise means acceptance; throw or reject to display a retryable error. Honor the supplied abort signal to stop work when the timeout expires or the widget is destroyed. A timeout cannot undo a submission your server has already accepted.

### App lifecycle

```js
feedback.update({ position: 'left', offset: '65%' });
feedback.openFeedback();
feedback.startAnnotation();
feedback.openAbout();
feedback.closeDialog();

// For example, when your app shell unmounts:
feedback.destroy();
// Or: Uinotate.destroy();
```

`update()` merges top-level options. Supplying `theme`, `headers`, or `metadata` replaces that object. Empty `theme: {}` removes inline theme overrides and reveals the stylesheet's values again.

The active instance is available as `Uinotate.instance`. The widget emits bubbling `uinotate:success` events with `{ payload, result }` and `uinotate:error` events with `{ error }` in `event.detail`. Notification callback failures are logged without changing a successful send into an error.

## Customize the appearance

Override variables in CSS loaded after `uinotate.css`:

```css
[data-uinotate] {
  --uinotate-accent: #287465;
  --uinotate-accent-hover: #1f5c50;
  --uinotate-soft: #f0f7f3;
  --uinotate-radius: 10px;
  --uinotate-font-family: 'Your UI Font', system-ui, sans-serif;
}
```

The same names work in `theme`:

```js
feedback.update({
  theme: {
    '--uinotate-accent': '#287465',
    '--uinotate-accent-hover': '#1f5c50'
  }
});
```

| CSS variable | Purpose |
| --- | --- |
| `--uinotate-accent` | Launcher, primary buttons, selection outlines, and accent text. |
| `--uinotate-accent-hover` | Hover color for the launcher and primary buttons. |
| `--uinotate-surface` | Dialog and button surfaces. |
| `--uinotate-soft` | Subtle panel and hover backgrounds. |
| `--uinotate-text` | Main text and icon color. |
| `--uinotate-muted` | Secondary text and hints. |
| `--uinotate-border` | Borders around fields, dialogs, and buttons. |
| `--uinotate-radius` | Dialog corner radius. |
| `--uinotate-font-family` | Widget font stack. |
| `--uinotate-shadow` | Dialog and selection instruction shadows. |

Scoped classes such as `.uinotate-dialog`, `.uinotate-launcher`, `.uinotate-action`, and `.uinotate-primary-button` can be overridden for more extensive customization. All widget DOM is in the light DOM, marked with `data-uinotate`; its CSS does not intentionally restyle host page elements. Apply shared variable overrides to `[data-uinotate]` so the dock, dialog, picker, and highlight all receive them. Very broad host CSS can still affect it, so load the widget's CSS after application styles.

## API payload

Both feedback types use a versioned JSON envelope. An annotation adds `element`:

```json
{
  "schemaVersion": 1,
  "id": "54e72d0a-c88c-4bc6-9a12-4c26f807b3cd",
  "type": "annotation",
  "message": "This button needs more room around it.",
  "category": "layout",
  "createdAt": "2026-10-14T09:00:00.000Z",
  "page": {
    "url": "https://example.com/settings",
    "title": "Settings",
    "viewport": { "width": 1280, "height": 800, "devicePixelRatio": 2 },
    "scroll": { "x": 0, "y": 120 }
  },
  "metadata": { "project": "my-app", "release": "2026.10" },
  "element": {
    "selector": "#save-button",
    "tagName": "button",
    "id": "save-button",
    "classes": ["primary"],
    "rect": { "x": 24, "y": 480, "width": 120, "height": 40, "pageX": 24, "pageY": 600 },
    "styles": { "display": "inline-block", "background-color": "rgb(40, 116, 101)" },
    "screenshot": {
      "mimeType": "image/png",
      "dataUrl": "data:image/png;base64,iVBORw0KGgo...",
      "width": 240,
      "height": 80,
      "byteLength": 6412,
      "capturedAt": "2026-10-14T09:00:00.000Z"
    }
  }
}
```

Quick feedback uses `type: 'feedback'`, `category: 'general'`, and omits `element`. Annotation categories are `style`, `layout`, `content`, `interaction`, and `other`. Rectangle coordinates use CSS pixels; `x/y` are relative to the viewport and `pageX/pageY` include page scrolling. The example above abbreviates the style map and PNG data. Real payloads contain the complete base64 PNG.

`element.screenshot` is included only when capture succeeds and “Attach element screenshot” is checked. `width/height` are raster pixel dimensions and `byteLength` is the decoded PNG size. The PNG is captured at selection or retake, alongside the element selector, rectangle, and styles; retries reuse the reviewed image. Rasterization uses up to 2× device resolution, bounded by the configured dimension and byte limits. The playground displays the attached image and abbreviates base64 in its JSON inspector, while posting the complete data to the endpoint.

Base64 adds roughly one third to the binary size. Allow sufficient JSON request body capacity on your API and reverse proxy; the default 300 KB PNG needs about 400 KB of JSON plus the message and element context. The local demo allows 1 MiB requests and validates the PNG header, dimensions, and byte count before acknowledging it. It still discards the submission.

## Screenshot capture and exclusions

Capture uses the bundled [html-to-image renderer](https://github.com/bubkoo/html-to-image) to reconstruct the selected subtree through SVG and canvas. It runs locally without requesting display-sharing permission and excludes Uinotate's own UI. It does not capture the entire desktop or page.

The image is a DOM-rendered snapshot, so complex CSS, parent transforms, clipping, video/canvas content, and inaccessible cross-origin assets can differ from the page. The selected root's positioning, margin, and transforms are normalized for a standalone element image. Font rules are read without modifying host stylesheets; inaccessible font stylesheets fall back to available fonts. Asset requests omit cookies and referrers. Authenticated or CORS-blocked images/fonts may be missing. CSP must allow the renderer's `data:` images and any asset requests it needs.

Form fields, editable content, iframe internals, and widget nodes are excluded. If the selected element itself is a form field, editable node, iframe, or private subtree, no screenshot is attached. Excluded descendants are removed from other element snapshots. Mark application content you want excluded using:

```html
<section data-uinotate-private>Content excluded from screenshots</section>
```

Screenshots capture visible text in other elements, even when `includeElementText` is false; that option controls the separate text excerpt only. The user can review the image and uncheck the attachment before sending. Nothing is uploaded until the annotation is submitted. Capture errors display a message and keep the text annotation usable.

To turn off capture for an embedding app:

```js
Uinotate.init({ apiUrl: '/api/feedback', captureScreenshot: false });
```

## Configure the receiving API

Set `apiUrl` to the route that will store feedback, and set `token` if that route requires Bearer authentication:

```js
const feedback = Uinotate.init({
  apiUrl: 'https://feedback.example.com/v1/feedback',
  token: () => getFeedbackToken(),
  headers: { 'X-Project': 'website' },
  metadata: { project: 'website', release: '1.0.0' },
  requestTimeout: 15000,
  captureScreenshot: true,
  screenshotMaxDimension: 1200,
  screenshotMaxBytes: 300000
});
```

`headers` and `metadata` serve different purposes: headers configure the HTTP request, while metadata is included in the submitted JSON. Bearer tokens are sent in the authorization header and are not added to the feedback payload. Without `apiUrl` or `onSubmit`, the widget remains usable for entering feedback, but sending displays a configuration error.

The built-in transport sends `Content-Type: application/json` and, when configured, `Authorization: Bearer <token>`. Any HTTP 2xx response means acceptance, including an empty `204`; other status codes are failures. Response bodies are not interpreted. Requests omit cookies and the HTTP referrer. An HTTPS page needs an HTTPS service.

For a service on a different origin, configure its CORS preflight response for the embedding website. For example:

```http
Access-Control-Allow-Origin: https://www.example.com
Access-Control-Allow-Methods: POST, OPTIONS
Access-Control-Allow-Headers: Content-Type, Authorization, X-Project
Vary: Origin
```

The `OPTIONS` preflight should not require the Bearer token that will be sent on the actual POST. Return the allowed origin on the POST response too, including error responses. Use the embedding website's actual origin and list any custom headers your integration sends.

The backend owns validation, storage, rate limits, token verification, and access to submitted feedback. The included demo endpoint is only a wiring example.

## Interaction and limits

- Hover or focus opens the arc; tapping/clicking the launcher also opens it. An outside press, Escape, or leaving the dock without keyboard focus closes it.
- Native modal dialogs contain keyboard focus. Escape, the close button, and a backdrop click close an idle dialog; sending keeps it open until success or failure.
- Pick an element with the pointer, or Tab to a focusable page element and press Enter/Space. Escape cancels selection. The selection click is captured so normal element click handlers do not run.
- Drafts survive errors and closing/reopening dialogs during the current widget session. Successful sends clear the relevant draft. Reloading or destroying the widget clears all drafts; they are never persisted.
- `prefers-reduced-motion` disables widget animations.
- URLs omit query strings and fragments. Page titles, selectors, IDs, classes, styles, and custom metadata can still contain application information; choose metadata and text capture deliberately.
- Version 0.1 selects elements in the current document's light DOM. Iframe internals and shadow-root internals are outside its selection scope. Canvas content is represented by its canvas element.
- Selectors identify the current DOM snapshot, and can change when an app reorders or remounts elements. Include a route/release identifier in metadata when useful. Removed elements produce an error and can be selected again.
- Pointer/mouse handlers that run before the selection click, or previously registered document capture handlers, may still run. Submitted payloads do not serialize HTML or include form input values.
- Current browsers with native `dialog`, `inert`, Pointer Events, CSS custom properties, and `fetch` are the intended target.

## Development checks

```sh
bun run test
bun run check
```

The widget build and example server use Bun; `bun run check` also requires Node.js for its syntax checks. After editing JavaScript under `src/`, rebuild `lib.js` and reload the example page. Changes to `uinotate.css` can be tested with a page reload.

Tests cover request headers and payloads, selector accuracy, selection click suppression, keyboard cancellation, opt-in text capture, errors/retries, draft retention, timeouts, duplicate sends, lifecycle cleanup, screenshot attachment/omission, privacy exclusions, capture races, image limits, signed session validation, streamed request size limits, static publish isolation, and the local server. Happy DOM supplies headless DOM tests; renderer adapters keep those tests deterministic. Real rasterization is checked in the browser examples.

Widget source is in `src/widget.js` and screenshot logic is in `src/screenshot.js`. Run `bun run build` after source changes to regenerate the distributable `lib.js`; `bun run test` builds it first so tests exercise the current bundle. Editing `lib.js` directly will be overwritten by a build. html-to-image is a pinned build dependency, and its MIT license is included in the generated bundle. Consumers still deploy only `lib.js` and `uinotate.css`.
