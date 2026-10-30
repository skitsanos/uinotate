# Feedback payload format

This document describes the JSON emitted by Uinotate v0.1.0 with `schemaVersion: 1`. Use it when building an ingestion endpoint, feedback inbox, or annotation dashboard. The [JSON Schema](payload-v1.schema.json) describes the same structure; complete, parseable examples are available for [quick feedback](payload-examples/feedback.json) and [annotations](payload-examples/annotation.json).

## Delivery

With `apiUrl` configured, the widget sends one JSON object per request:

```http
POST /your-feedback-endpoint HTTP/1.1
Content-Type: application/json
Authorization: Bearer <token>
```

The authorization header is included when a configured token provider returns a nonempty token. Tokens are not added to the JSON. The request omits cookies and the HTTP referrer. Custom `headers` are separate from `metadata`; metadata is part of the body. A cross-origin service needs [CORS configuration](../README.md#configure-the-receiving-api).

If an application uses `onSubmit(payload, { signal })`, it receives the same payload object instead of the built-in HTTP request. The callback controls its own transport. The widget does not send an About event, selection event, or screenshot upload separately: an attached image travels inside the submitted annotation.

## Shared envelope

Every normal widget submission includes all these fields. “Required” here describes widget output; the demo endpoint's smaller validation subset is described below.

| Field | JSON type | Meaning |
| --- | --- | --- |
| `schemaVersion` | integer | Currently `1`. This is the payload version, separate from the JavaScript library version. |
| `id` | string | New client-generated identifier for each send attempt. Usually a UUID; the browser fallback starts with `uinotate-`. Accept it as an opaque string. |
| `type` | string | `feedback` or `annotation`. |
| `message` | string | User's message, trimmed before sending. The normal form requires non-whitespace text. Default form limit: 5,000 JavaScript UTF-16 code units, configurable with `maxLength`. Line breaks inside the message are preserved. |
| `category` | string | `general` for quick feedback; one of the annotation categories below for an annotation. |
| `createdAt` | string | Client UTC timestamp in ISO 8601 form, such as `2026-10-30T10:00:00.000Z`. Created for each send attempt, before token lookup or transport. |
| `page` | object | Page context at that send attempt; see below. |
| `metadata` | object | Application-supplied, JSON-serializable context. Defaults to `{}`. No project, user, release, or environment keys are reserved or automatically added. Use a plain JSON object. |

Quick feedback omits `element` entirely. An annotation additionally requires the `element` object. Optional fields are omitted, rather than sent as `null`, except that `element.id` is explicitly `null` when the element has no ID.

### Categories

| `type` | `category` | Widget label |
| --- | --- | --- |
| `feedback` | `general` | Quick feedback; no category picker |
| `annotation` | `style` | Visual style; default annotation category |
| `annotation` | `layout` | Layout & positioning |
| `annotation` | `content` | Content |
| `annotation` | `interaction` | Interaction |
| `annotation` | `other` | Something else |

### Page context

All fields in this table are included under `page`.

| Field | JSON type | Meaning |
| --- | --- | --- |
| `url` | string | Browser `location.origin + location.pathname`. Query string and fragment are omitted, including hash-based application routes. For a dashboard, treat this as the submitted page location, not a URL guaranteed to be reachable. Pages opened from disk can have a `null` origin. |
| `title` | string | Document title; may be empty. |
| `viewport.width`, `viewport.height` | number | Browser viewport dimensions in CSS pixels at submission. |
| `viewport.devicePixelRatio` | number | Device pixel ratio at submission. It is not necessarily the screenshot's scale factor. |
| `scroll.x`, `scroll.y` | number | Page scroll offsets in CSS pixels at submission. |

Applications that use query or hash routes can put an intentionally selected route identifier in `metadata`. The widget does not otherwise redact page titles, element identifiers, style values, or custom metadata.

## Annotation element

The required fields below are collected when the user selects the element. A screenshot retake refreshes this context before capture. They are a snapshot, not a live DOM reference.

| Field under `element` | JSON type | Presence and meaning |
| --- | --- | --- |
| `selector` | string | Required. CSS selector for the selected element in that document snapshot. Uses a unique escaped ID when possible, or a path that can include `:nth-of-type()`. It is not a stable identifier across releases, remounts, or DOM changes. |
| `tagName` | string | Required. Element's `localName`, for example `button`, `div`, or `svg`. |
| `id` | string or null | Required. Element ID, or `null` if absent. |
| `classes` | array of strings | Required. Element class list; empty array if none. |
| `rect` | object | Required. Rectangle described below. |
| `styles` | object of string values | Included when `collectStyles: true` (default). Omitted when disabled. CSS property names use kebab-case; values are computed CSS strings, not numeric measurements. Values can be empty. |
| `text` | string | Opt-in with `includeElementText: true`. Whitespace is collapsed, trimmed, and sliced to at most 300 JavaScript UTF-16 code units. It can be empty. Omitted if the selected element is inside, or contains, an input, textarea, select, or editable element. |
| `screenshot` | object | Included only when capture succeeds and the user leaves the attachment checked. See below. |

`styles` currently contains these 15 properties:

```text
display, position, color, background-color, font-family, font-size,
font-weight, line-height, padding, margin, border, border-radius,
gap, align-items, justify-content
```

### Rectangle and timing

`element.rect` always has six numeric fields, in CSS pixels, rounded to two decimal places:

| Field | Meaning |
| --- | --- |
| `x`, `y` | Top-left of the bounding rectangle relative to the viewport at selection or retake. Can be negative for partly offscreen content. |
| `width`, `height` | Bounding rectangle dimensions. These can differ from the untransformed element's dimensions. |
| `pageX`, `pageY` | `x + scrollX` and `y + scrollY`, using scroll offsets at selection or retake, then rounded. |

`page` is collected at submission, but `element` context is collected earlier. If the user scrolls or resizes before sending, **do not recompute `pageX/pageY` using `page.scroll`**, and do not assume the two sets of coordinates describe the same instant. Retrying reuses the reviewed element snapshot and image, unless the user retakes or changes the target. Selecting a disconnected element at send time produces a client error instead of a submission.

## Screenshot attachment

All six fields below are present when `element.screenshot` exists. There is no separate screenshot URL or multipart upload.

| Field under `element.screenshot` | JSON type | Meaning |
| --- | --- | --- |
| `mimeType` | string | Always `image/png`. |
| `dataUrl` | string | Complete `data:image/png;base64,` URL. Decode the characters after the comma to obtain PNG bytes. |
| `width`, `height` | integer | Positive raster pixel dimensions of the encoded PNG, after any downscaling. These are not CSS pixels. |
| `byteLength` | integer | Decoded PNG byte count, excluding the data URL prefix and base64 expansion. Verify it against the decoded bytes. |
| `capturedAt` | string | Client UTC ISO 8601 timestamp when image export finishes. It can be earlier than `createdAt`, especially after typing or retrying. |

The [annotation example](payload-examples/annotation.json) includes a complete, valid 1×1 PNG fixture (68 decoded bytes) to keep the example small. It illustrates the attachment format rather than the appearance of the example button. The playground's JSON preview shortens `dataUrl` for display; the HTTP body and `onSubmit` payload contain the full string.

By default, capture uses up to two raster pixels per CSS pixel, capped by the device pixel ratio, a maximum image dimension of 1,200 pixels, and at most 300,000 decoded bytes. These limits can be configured: `screenshotMaxDimension` accepts 32–4,096, and `screenshotMaxBytes` accepts 1,024–2,000,000. Choose ingestion limits for your embedding configuration; the schema allows the configurable range rather than hard-coding the defaults. Base64 uses `4 × ceil(byteLength / 3)` characters, plus the 22-character data URL prefix. A default-size PNG therefore needs about 400 KB in JSON, before the remaining payload.

Missing `screenshot` is a normal annotation: capture may be disabled, unchecked, excluded, failed, or timed out. The payload does not include a capture status or distinguish these reasons. Do not reject a valid text-only annotation.

Capture reconstructs the selected DOM subtree; it is not a screen recording or an exact full-page screenshot. Form fields, editable content, iframe internals, widget UI, and subtrees marked `data-uinotate-private` are excluded from capture. The separate `text` excerpt uses its own form/editable exclusion rules; `data-uinotate-private` does not redact that excerpt, selector, ID, classes, or styles. Visible text in other captured content can appear in the PNG even when `includeElementText` is false. See [screenshot exclusions and rendering limits](../README.md#screenshot-capture-and-exclusions).

## Receiving and displaying submissions

1. Authenticate the request using your application's rules and associate it with the correct project or tenant on the server. Metadata is client-supplied context, not proof of identity or authorization. The public demo's anonymous signed sessions illustrate Bearer transport only.
2. Check `schemaVersion` and validate the known shape with the [schema](payload-v1.schema.json), then apply your own body, message, metadata, and image limits. It uses [JSON Schema Draft 2020-12](https://json-schema.org/draft/2020-12); enable date-time format assertions in your validator if you need them. Unknown object fields are allowed for additive extensions. Unsupported schema versions are not implicitly compatible.
3. If an image is present, strictly decode its base64, verify the actual PNG format, dimensions and byte count, and apply your image-decoding limits. JSON Schema checks structure; it does not verify binary contents or agreement between the image header and the declared fields. Store the PNG in your chosen attachment storage and reference it from the stored feedback record.
4. Record a server-side ingestion ID and `receivedAt` timestamp separately. Preserve the submitted `id`, `createdAt`, and `capturedAt` as client context. Neither the widget ID nor its client timestamps establish identity or a trusted event order.
5. Render the message, text excerpt, selector, metadata, and style strings as text in the dashboard. Display an optional image preview, and let users filter by `type`, `category`, page location, and application-defined metadata. An absent excerpt, styles map, or image should not prevent viewing the annotation.

The schema describes normal widget output, including its full page/element context. The included demo API intentionally validates a smaller subset: it accepts a missing `schemaVersion` but rejects a non-1 value, requires a nonempty `id` up to 150 characters and a non-whitespace message up to 5,000 JavaScript code units, checks the type and annotation selector (up to 2,048 characters), and validates attached PNG headers, dimensions and byte counts. It does not fully validate page, category, metadata, dates, or all element fields. It rejects non-null `element` on quick feedback, limits total JSON bodies to 1 MiB and PNGs to 300,000 bytes / 1,200 pixels, and acknowledges then discards data. Use your own validation and persistence for an ingestion dashboard.

### Responses and retries

Any HTTP **2xx** response is acceptance for the built-in transport, including `201`, `202`, and an empty `204`. The widget does not parse a response body or display server-provided error messages. Return a 2xx status once you have durably stored or queued the record. Other status codes, network failures, and timeouts produce a retryable UI error and retain the user's draft. There is no automatic retry, `Retry-After` handling, or built-in offline queue.

You may return JSON such as the following, but no response fields are required by the widget:

```json
{ "accepted": true, "id": "your-server-record-id" }
```

For custom `onSubmit`, a resolved promise means acceptance and a thrown/rejected error means failure. A callback that makes HTTP requests must check their status itself.

Each manual send attempt creates a **new `id` and `createdAt`**, including retries of the same draft. No `Idempotency-Key` header is supplied. An aborted or timed-out request can already have reached your server. Deduplicating by the submitted ID handles replay of that exact request, but does not deduplicate a user's retry. If exactly-once storage matters, implement a stable draft identifier and idempotency policy through your own `onSubmit` integration and backend.

The payload has no built-in inbox status, severity, user profile, browser/OS summary, library version field, or full HTML snapshot. Add dashboard workflow fields on the server; pass deliberate application context such as project and release through `metadata`.
