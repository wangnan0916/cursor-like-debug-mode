# Manual Checkpoints

Read this reference at each reproduction or verification gate.
Checkpoint answers are protocol messages rather than progress summaries.
A native checkpoint presents context, then one tool call.
A Pi checkpoint contains only its chooser call.
A plain-text checkpoint contains one exact fallback template.

## Gate Invariant

An active debug session survives user replies, tool results, retries, and context compaction.
Every manual reproduction or verification attempt opens a fresh checkpoint.
A checkpoint result authorizes only the current manual attempt.
After routing a result, any later attempt starts again from path selection below.

Use the first available path in this order:

1. Native Codex path
2. Pi chooser path
3. Plain-text path

## Native Codex Path

Use this path when `request_user_input` is listed and the session can accept an interactive answer.
Before the call, show these fields in this order:

```text
The manual debug checkpoint is ready:

- Phase: <pre-fix or post-fix>
- Session: <session_id>
- Log file: <LOG_FILE>
- Debug endpoint: <LOG_SERVER_URL>/log
```

Call `request_user_input` once with the applicable payload. Then wait for its result.

### Pre-Fix Native Payload

```json
{
  "questions": [
    {
      "header": "Reproduce",
      "id": "reproduction_result",
      "question": "Reproduce the original bug manually, then choose the result.",
      "options": [
        {
          "label": "Reproduced (Recommended)",
          "description": "The bug appeared again, so the current log can be analyzed."
        },
        {
          "label": "Issue disappeared",
          "description": "The bug did not appear, so the trigger or probes need adjustment."
        }
      ]
    }
  ]
}
```

Map `Reproduced (Recommended)` to `A`.
Map `Issue disappeared` to `B`.

### Post-Fix Native Payload

```json
{
  "questions": [
    {
      "header": "Verify fix",
      "id": "verification_result",
      "question": "Verify the original bug manually, then choose the result.",
      "options": [
        {
          "label": "Fixed (Recommended)",
          "description": "The acceptance criterion passed, so temporary instrumentation can be removed."
        },
        {
          "label": "Still reproducible",
          "description": "The bug remains, so post-fix evidence needs more analysis."
        }
      ]
    }
  ]
}
```

Map `Fixed (Recommended)` to `B`.
Map `Still reproducible` to `A`.

Codex supplies a free-form Other choice automatically. Map its submitted text to `C` evidence.
If the native tool is absent or errors, continue to the Pi chooser path.
A native cancellation leaves the gate pending. Stop without selecting a result or falling back.

## Pi Chooser Path

When `debug_mode_checkpoint` is available, call it as the response's only tool.
Pass the real `phase`, `session`, `logFile`, and `debugEndpoint` values.
Use `pre-fix` for reproduction and `post-fix` for verification.
Repeat this tool call for every later attempt in either phase.

The chooser presents exactly these options:

```text
A - Reproduced
B - Fixed
C - Other: enter details
```

Option `C` opens a free-form editor. Treat its submitted text as the checkpoint evidence.
A `cancelled` or `ui_unavailable` result switches to the applicable fallback template.

## Plain-Text Path

Use plain text when both interactive paths are unavailable or the Pi chooser returns a fallback result.
Send exactly the applicable template. Then wait for a typed reply.

### Pre-Fix Template

```text
I added debug-mode probes.
The collector writes to these locations:

- Session: <session_id>
- Log file: <LOG_FILE>
- Debug endpoint: <LOG_SERVER_URL>/log

Reproduce the bug manually. Then, select one option:

A - Reproduced
B - Fixed
C - Other: describe what happened
```

### Post-Fix Template

```text
I kept the debug-mode probes active for post-fix verification.
The collector writes to these locations:

- Session: <session_id>
- Log file: <LOG_FILE>
- Debug endpoint: <LOG_SERVER_URL>/log

Verify the original bug manually. Then, select one option:

A - Reproduced
B - Fixed
C - Other: describe what happened
```

The user can request another language. Preserve every field, field order, and option when translating.

## State Table

| Phase | Result | Route |
| --- | --- | --- |
| Pre-fix | `A` | Read current NDJSON evidence and classify every hypothesis. |
| Pre-fix | `B` | Record that probes changed reproduction. Request a narrower trigger or clarification. |
| Pre-fix | `C` | Use the supplied details to adjust the trigger, hypotheses, or probes. |
| Post-fix | `A` | Read post-fix evidence. Return to narrower hypotheses or probes. |
| Post-fix | `B` | Accept the stated criterion and begin mechanical cleanup. |
| Post-fix | `C` | Use the supplied details to adjust verification, hypotheses, or probes. |
