# Debug Probe Extension

Read the sibling [`trace-mode` probe guide](../../trace-mode/references/probes.md) first.
Use its helpers, privacy allowlist, delivery contract, and `LOG_SERVER_PROBE` markers.

## Discriminating Events

Place events at boundaries between live hypotheses.
Prefer one event that confirms one hypothesis while rejecting another.
Keep probe names stable across pre-fix and post-fix runs.

Extend the generic event with `hypothesis` and the current `runId`:

```json
{
  "session": "<session_id>",
  "runId": "pre-fix",
  "probe": "settings.beforePersist",
  "hypothesis": "H1",
  "file": "src/settings/save.ts",
  "fn": "saveSettings",
  "vars": {
    "enabled": true,
    "userId": "redacted"
  }
}
```

Use `runId: "pre-fix"` before the fix.
Use `runId: "post-fix"` after the fix.

## Example Region

```ts
// #region LOG_SERVER_PROBE <session_id> settings-before-persist
logServerLog({
  runId: "pre-fix",
  probe: "settings.beforePersist",
  hypothesis: "H1",
  file: "src/settings/save.ts",
  fn: "saveSettings",
  vars: { enabled, userId: "redacted" },
});
// #endregion LOG_SERVER_PROBE <session_id>
```

**Complete when:** every live hypothesis has a privacy-reviewed event with falsifiable record conditions.
