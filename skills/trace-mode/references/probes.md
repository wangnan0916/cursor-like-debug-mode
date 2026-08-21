# Temporary Log Design

Read this reference before adding temporary instrumentation.

## Event Shape

Use stable probe names around the traced boundary:

```json
{
  "session": "<session_id>",
  "runId": "trace-1",
  "probe": "settings.beforePersist",
  "file": "src/settings/save.ts",
  "fn": "saveSettings",
  "vars": {
    "enabled": true,
    "userId": "redacted"
  }
}
```

Record state transitions instead of every high-frequency call.
Sampling is acceptable when causal ordering remains visible.
Send events to `<LOG_SERVER_URL>/log` instead of product output streams.

## Privacy Allowlist

Build `vars` from explicit, trace-relevant fields.
Use redacted identifiers when identity is necessary.

Exclude these values:

- Secrets, tokens, cookies, authorization headers, and API keys
- Raw requests or responses containing private data
- Personal data unrelated to the runtime question

## Mechanical Regions

Wrap every temporary helper and event with the session marker:

```ts
// #region LOG_SERVER_PROBE <session_id> settings-before-persist
logServerLog({
  probe: "settings.beforePersist",
  file: "src/settings/save.ts",
  fn: "saveSettings",
  vars: { enabled, userId: "redacted" },
});
// #endregion LOG_SERVER_PROBE <session_id>
```

Use the file's native comment syntax outside JavaScript.
Preserve `LOG_SERVER_PROBE <session_id>` in both markers.

## Runtime Helpers

Copy [`../assets/browser-log-helper.js`](../assets/browser-log-helper.js) for browser or frontend JavaScript.
Copy [`../assets/node-log-helper.js`](../assets/node-log-helper.js) for Node.js or server JavaScript.
Replace `<session_id>` and `<LOG_SERVER_URL>`.
Keep the helper name `logServerLog`.

For another runtime, write the smallest local client beside the traced boundary.
Follow [`protocol.md`](protocol.md).
Delivery failures must leave product behavior unchanged.
