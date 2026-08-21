# Domain Glossary

Shared vocabulary for runtime-debug-toolkit. Use these terms in docs, code, and
architecture discussions; don't invent synonyms.

## Workflows

- **Trace Mode** — standalone workflow: instrument, capture one trace, locate the responsible code boundary. No product fix.
- **Debug Mode** — extends Trace Mode through hypothesis proof, fix, verification, and cleanup. The caller of Trace Mode.
- **Trace Card** — Trace Mode step 1 artifact: runtime question, trigger, candidate path, unknown boundary, observable answer.
- **Bug Card** — Debug Mode counterpart: symptom, trigger, candidate path, evidence, acceptance criterion.
- **Hypothesis Matrix** — ranked falsifiable hypotheses (H1..Hn), each with a prediction, probe, and CONFIRMED/REJECTED condition.

## Instrumentation

- **Probe** — one planned low-volume event logged around a disputed boundary. Named like `settings.beforePersist`.
- **Session marker** — `LOG_SERVER_PROBE <session_id>` region wrapper that makes temporary instrumentation mechanically removable.
- **Collector Contract** — the values a workflow must capture after arming the server: `logServerUrl`, `sessionId`, `logDir`, `logFile`, `healthUrl`. Printed as KEY=VALUE lines plus one machine-readable `COLLECTOR_CONTRACT=` JSON line.

## Collector runtime

- **Sink** — the NDJSON HTTP server (`scripts/collector-server.mjs`): accepts `POST /log`, appends one record, exposes `/health`.
- **Ensure orchestration** — CLI-side logic (`scripts/log-server.mjs`): reuse a healthy server or lock, start a detached child, wait for health.
- **State File Contract** — the discovery record the detached server writes to the `--state` path; schema documented beside its writer in `collector-server.mjs`. Only the wrapper and its own child read or write it.
- **Safe wrapper** — `scripts/start-collector.mjs`: fixes host to `127.0.0.1`, port to `0`, implies `--ensure`.

## Checkpoints

- **Checkpoint Gate** — a mandatory human interaction (reproduction, verification, manual trigger) that blocks workflow progress until answered.
- **Gate invariant** — every manual attempt requires a fresh checkpoint; a previous result authorizes only its own attempt.
- **Checkpoint paths** — resolution order: native Codex `request_user_input`, then the Pi chooser tool (`debug_mode_checkpoint` / `trace_mode_checkpoint`), then a plain-text template fallback.
- **Chooser spec** — code-defined choices per workflow (never model-supplied): phases, choice labels/meanings, which choice opens the free-form editor.
