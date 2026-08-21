# Event Protocol

Read this reference before connecting a producer.

## Request

Send one JSON object per request:

```text
POST <LOG_SERVER_URL>/log
Content-Type: application/json
```

The server adds an ISO timestamp in `ts`.
It uses the request's `session` when present.
Otherwise it uses the server's default session.

Session IDs accept letters, digits, dots, underscores, and hyphens.
Request bodies larger than one MiB are rejected.
Arrays and non-object JSON values are rejected.

## Response

A successful response has HTTP status `200` and this shape:

```json
{
  "ok": true,
  "session": "example-session",
  "logFile": "/temporary/path/example-session.ndjson"
}
```

The append completes before success is returned.
Failed appends return a non-success status and an `error` field.

## Producer Safety

Build events from an explicit allowlist of consumer-required fields.
Exclude secrets, tokens, cookies, authorization headers, and unrelated personal data.
Treat delivery as best-effort when the producer must continue without the server.
Avoid high-volume events unless the request requires them.
