# Ingestion dashboard example

A small Bun server that receives Uinotate payloads, saves them to SQLite, and displays feedback, annotations, and PNG attachments in a browser inbox. It uses the existing [payload schema](../../docs/payload-v1.schema.json), with date-time validation and full PNG decoding. The interface uses plain HTML, CSS, and JavaScript.

## Run it

From the repository root, with Bun installed:

```sh
bun install --frozen-lockfile
export UINOTATE_INGEST_TOKEN="$(openssl rand -hex 32)"
export UINOTATE_DASHBOARD_TOKEN="$(openssl rand -hex 32)"
bun run dev:ingestion
```

Open [http://127.0.0.1:4180](http://127.0.0.1:4180) and enter the value of `UINOTATE_DASHBOARD_TOKEN`. In the terminal where you exported it, `printf '%s\n' "$UINOTATE_DASHBOARD_TOKEN"` displays the key for copying. Keep the terminal/session values or provide your own stable keys if you want the same keys after restarting.

The viewing key stays in browser memory, not local storage, cookies, or URLs. Reloading or selecting **Lock inbox** clears it. A submission key cannot read feedback, and a viewing key cannot submit it. Keys must be different and contain 32–512 non-whitespace characters.

## Try the complete widget flow

1. Open **Widget test page** at [/try](http://127.0.0.1:4180/try).
2. Enter `UINOTATE_INGEST_TOKEN` as the submission access key. Use `printf '%s\n' "$UINOTATE_INGEST_TOKEN"` in your configured terminal to display it.
3. Use the widget's Quick feedback or Annotate action. Select the sample button or card, review its screenshot, and send the note.
4. Return to the inbox and select **Refresh**. Select a record to view its note, page context, element, optional screenshot, metadata, and payload preview.

The submission key field is excluded from screenshots. The inbox supports type/category filters, literal text search over messages/pages/selectors, and pages of 25 records. Screenshots appear on the detail view; the list API does not transfer image data. The JSON preview abbreviates base64 for readability; stored payloads keep the complete attachment.

## Connect another page

```js
Uinotate.init({
  apiUrl: 'http://127.0.0.1:4180/api/feedback',
  token: () => getSubmissionToken(),
  metadata: { project: 'my-app', release: '1.0.0' }
});
```

`getSubmissionToken()` should return the configured submission key for this local example, without `Bearer `. Never put the viewing key in an embedding app. Browser code is visible to its users; a real application should issue appropriately scoped submission tokens using its own authentication.

For a page served from a different origin, set `UINOTATE_ALLOWED_ORIGINS` before starting the server, for example:

```sh
export UINOTATE_ALLOWED_ORIGINS="http://127.0.0.1:4173,http://localhost:3000"
bun run dev:ingestion
```

Origins must be exact HTTP(S) origins without paths or trailing slashes. CORS allows only `POST, OPTIONS` with `Content-Type, Authorization` on the ingestion endpoint. Error responses include the allowed origin too. The read API stays same-origin. Serve the embedding page over HTTP locally. For a deployed HTTPS page, host the ingestion service over HTTPS too.

## Configuration and storage

| Variable | Default | Purpose |
| --- | --- | --- |
| `UINOTATE_INGEST_TOKEN` | Required | Bearer key for `POST /api/feedback`. |
| `UINOTATE_DASHBOARD_TOKEN` | Required | Separate Bearer key for reading records. |
| `UINOTATE_INGESTION_PORT` | `4180` | HTTP port; server binds to `127.0.0.1`. |
| `UINOTATE_DATABASE_PATH` | `.data/ingestion.sqlite` | SQLite path relative to the current working directory, unless absolute. |
| `UINOTATE_ALLOWED_ORIGINS` | Empty | Comma-separated additional origins allowed to submit. |

SQLite stores the complete submitted JSON, including base64 PNGs, and server-generated record IDs/receipt timestamps. Records survive restarts and there is no automatic expiry or delete action. Keep `.data/` out of source control; it is already ignored. Back up or retain the database and its SQLite WAL files appropriately while the server is running.

Each request is limited to 4 MiB, messages to 5,000 JavaScript code units, client IDs to 150 characters, selectors to 2,048 characters, and images to 2,000,000 decoded bytes / 4,096 pixels per dimension. PNG signatures, canonical base64, declared size/dimensions, checksums, and decompression are checked before storage. Missing screenshots are valid. Additional JSON fields are retained as allowed by the shared schema. The server does not log payloads or credentials, and only explicitly listed browser files are served.

This is a single-project local example. Running it as a public service requires a server with durable storage, HTTPS, application/user authorization, and deployment-appropriate rate and storage limits. It does not run as a persistent SQLite service inside Netlify Functions. The existing public Netlify demo continues to acknowledge and discard submissions.

## HTTP endpoints

| Request | Key | Response |
| --- | --- | --- |
| `POST /api/feedback` | Submission | `201` once SQLite commits the validated payload. |
| `GET /api/records?type=annotation&category=layout&q=button&page=1` | Viewing | `{ records, total, page, pageSize, stats }`; summaries ordered by server insertion, newest first. Filters are optional. |
| `GET /api/records/:id` | Viewing | `{ id, receivedAt, payload }` including the original full screenshot data URL, if any. |

A successful submission returns `{ accepted: true, stored: true, id, receivedAt, duplicate }`. `id` is a server UUID, separate from the widget's `payload.id`; `receivedAt` is server time. List summaries include `clientId`, `type`, `category`, `message`, `pageUrl`, `pageTitle`, nullable `selector`, and `hasScreenshot` (`0` or `1`). `stats` contains unfiltered totals: `total`, `feedback`, `annotations`, and `screenshots`. `total` on the outer response counts filtered matches.

Replaying the same payload with the same client ID returns `200`, the original record ID/time, and `duplicate: true`. Reusing that ID for changed content returns `409`. Object-key order and insignificant JSON formatting do not affect replay detection. Uinotate creates a new client ID on a manual retry, so this does not deduplicate two distinct send attempts. See [retry behavior](../../docs/payload-format.md#responses-and-retries).

Errors return `{ error: "..." }`: `400` for malformed JSON/filters, `401` for a wrong key, `403` for a disallowed origin, `404` for a missing record/file, `405` for an unsupported method, `413` for an oversized body, `415` for a wrong content type, and `422` for an invalid payload or PNG. No user-supplied text is interpreted as HTML in the dashboard.

## Files and checks

- `server.js`: HTTP routes, schema/PNG validation, authentication, and SQLite persistence.
- `index.html`, `dashboard.css`, `dashboard.js`: inbox and record details.
- `try.html`, `try.js`: widget connected to this ingestion endpoint.
- [Tests](../../tests/ingestion.test.js): key separation, persistence, replay handling, validation, body limits, CORS, filtering/pagination, and source-file isolation.

Run `bun run test` and `bun run check` from the repository root. Bun's [SQLite driver](https://bun.com/docs/runtime/sqlite), [Ajv](https://ajv.js.org/), and [pngjs](https://github.com/pngjs/pngjs) are used by this example; none are added to the widget's browser bundle.
