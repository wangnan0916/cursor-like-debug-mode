# Server Lifecycle

Read this reference before starting or reusing the server.

## Safe Start

Run the wrapper with one session ID:

```bash
node <trace-mode-skill-dir>/scripts/start-collector.mjs --session <session_id>
```

The wrapper fixes the host to `127.0.0.1` and the port to `0`.
It also supplies `--ensure` to `log-server.mjs`.
Capture the printed Collector Contract — the five values plus their
machine-readable form on the final `COLLECTOR_CONTRACT=` line:

```text
LOG_SERVER_URL=<loopback origin>
SESSION_ID=<session_id>
LOG_DIR=<temporary log directory>
LOG_FILE=<session NDJSON path>
HEALTH_URL=<loopback health URL>
COLLECTOR_CONTRACT={"logServerUrl":"…","sessionId":"…","logDir":"…","logFile":"…","healthUrl":"…"}
```

Prefer copying the `COLLECTOR_CONTRACT` JSON object verbatim.
The five `KEY=VALUE` lines remain the human-readable form of the same contract.

A complete user-supplied set can replace the command.
Confirm `HEALTH_URL` before reusing that set.

## Runtime Contract

- `GET /health` reports server status.
- `POST /log` accepts one JSON object and appends one NDJSON line.
- `OPTIONS` supports browser preflight.
- A successful append returns HTTP `200`.
- Each session has a separate file and write queue.
- The default log directory is in the operating-system temporary directory.
- `LOG_FILE` appears after the first accepted event.
- One shared server can serve concurrent sessions.

The wrapper reuses healthy loopback state or starts a detached loopback child.
It writes state, startup, and log files outside the repository.
It makes no external network calls.

## State File Contract

The detached server publishes its discovery record at the `--state` path
(default `<tmp>/local-log-server-skill/collector.json`).
The schema lives beside the writer in `scripts/collector-server.mjs`;
`log-server.mjs` reads it back and re-validates the loopback URLs and pid
before any reuse. Only the wrapper and its own child write or read this file.

## Authorization Branch

Try the safe wrapper in the default sandbox first.
Request approval only after a clear permission, listener, or process error.
Use this justification:

```text
Start or reuse the loopback log server.
It binds only to 127.0.0.1.
It writes state and log files in the operating-system temporary directory.
It does not write to the repository.
It does not make external network calls.
```

An approval denial or service disconnect ends the attempt.
Send this template with the real command:

```text
Command authorization blocks local log collection.

Run this command in your terminal:

node <trace-mode-skill-dir>/scripts/start-collector.mjs --session <session_id>

Paste the printed LOG_SERVER_URL, SESSION_ID, LOG_DIR, LOG_FILE, and HEALTH_URL.

I will wait before connecting the producer.
```

Wait for all five values before adding HTTP delivery.
