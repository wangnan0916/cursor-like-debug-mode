# Runtime Debug Toolkit for AI Coding Agents

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

Runtime Debug Toolkit is an open-source Agent Skills and Pi package for
instrumented runtime debugging in Codex, Pi, and other compatible AI coding
agents. It adds temporary structured logs, captures local NDJSON evidence,
locates the responsible code path, and can continue through a verified fix and
cleanup.

Use it when static code reading is not enough to explain which handler, state
transition, or async boundary caused an observed runtime behavior.

## Choose a workflow

| Skill | Outcome | Product code |
| --- | --- | --- |
| `$trace-mode` | Trace one runtime path and locate the responsible code boundary. | Temporary instrumentation only |
| `$debug-mode` | Prove a root cause, fix it, verify the result, and remove instrumentation. | Makes the evidence-backed fix |

`debug-mode` builds on the sibling `trace-mode` skill. Install both when you
want the complete debugging workflow. `trace-mode` can run independently.

## Quick start

### Agent Skills clients

Install from the public GitHub repository with the open Agent Skills CLI:

```bash
npx skills add wangnan0916/runtime-debug-toolkit
```

List the included skills before installing:

```bash
npx skills add wangnan0916/runtime-debug-toolkit --list
```

Select both skills for `debug-mode`. You can select only `trace-mode` when you
want code-location evidence without a product fix.

### Codex plugin

Add the repository marketplace, then install the plugin:

```bash
codex plugin marketplace add https://github.com/wangnan0916/runtime-debug-toolkit.git --ref main
codex plugin add runtime-debug-toolkit@runtime-debug-toolkit
```

The Codex plugin contains both skills. It does not load the Pi extension, an
MCP server, or an external service.

### Pi package

Install the current package directly from GitHub:

```bash
pi install git:github.com/wangnan0916/runtime-debug-toolkit
```

After the npm release is available, the versioned package installs with:

```bash
pi install npm:runtime-debug-toolkit
```

The Pi package loads both slash commands (`/debug-mode`, `/trace-mode`) and
the interactive checkpoint chooser. In Pi, the workflows are exposed only
through the extensions: the commands inject the bundled SKILL.md content
directly, so the same workflow is not registered twice as a skill.
Other Agent Skills clients still read `skills/` as regular skills.

## Try it

Locate the handler responsible for a runtime event without fixing product code:

```text
$trace-mode trace which handler persists this setting after Save
```

Diagnose and fix a reproducible runtime bug:

```text
$debug-mode the setting resets after Save and reload
```

Pi also provides short commands:

```text
/trace-mode <runtime question>
/debug-mode <problem description>
```

## How it works

Trace Mode stops after evidence-backed code location:

```text
analyze code -> plan events -> arm server -> instrument -> trigger -> analyze logs -> locate code -> clean
```

Debug Mode continues through a verified correction:

```text
analyze code -> hypothesize -> trace with trace-mode -> prove -> fix -> verify -> clean
```

At manual checkpoints, Codex uses native phase-specific choices when available.
Pi uses the bundled A/B/C chooser for both workflows: `/debug-mode` gets the
reproduction and verification chooser, `/trace-mode` the capture chooser.
Other Agent Skills clients use a plain-text fallback. Active debug sessions continue across reproduction and verification
replies until cleanup or explicit abandonment.

## Local evidence loop

Both workflows share one loopback log server. It accepts a JSON object at
`POST /log`, appends one NDJSON record, and exposes state at `GET /health`.
Each debugging session uses a separate file and queue.

Agents start or reuse the collector with:

```bash
node <trace-mode-skill-dir>/scripts/start-collector.mjs --session <id>
```

The command reports the complete runtime contract:

```text
LOG_SERVER_URL=<loopback origin>
SESSION_ID=<id>
LOG_DIR=<temporary log directory>
LOG_FILE=<session NDJSON path>
HEALTH_URL=<loopback health URL>
```

The safe wrapper binds to `127.0.0.1` on an available port. It can reuse one
healthy server across concurrent sessions, while evidence remains separated in
the operating system temporary directory.

## Package layout

```text
.codex-plugin/
  plugin.json                      # Codex and ChatGPT plugin manifest

.agents/plugins/
  marketplace.json                # repository marketplace entry

extensions/
  debug-mode.ts                    # Pi /debug-mode command + checkpoint spec
  trace-mode.ts                    # Pi /trace-mode command + checkpoint spec
  checkpoint.mjs                   # shared interactive checkpoint module (select/editor loop)
  skill-prompt.mjs                 # shared SKILL.md prompt builder

skills/trace-mode/
  SKILL.md                         # trace and code-location workflow
  agents/openai.yaml
  assets/                          # browser and Node.js log helpers
  references/                      # event, collector, and checkpoint contracts
  scripts/                         # collector startup, sink, and lifecycle
    log-server.mjs                 # CLI + ensure orchestrator
    collector-server.mjs           # NDJSON HTTP sink (library)
    start-collector.mjs            # safe wrapper

skills/debug-mode/
  SKILL.md                         # hypothesis, fix, verify, and cleanup workflow
  agents/openai.yaml
  references/                      # debug probes and checkpoints

tests/
  log-server.test.mjs              # collector behavior and concurrency
```

## Safety and privacy

- The collector accepts only loopback hosts: `127.0.0.1`, `localhost`, or `::1`.
- The safe wrapper always uses `127.0.0.1` with an available port.
- The collector makes no external network calls.
- Probe payloads exclude secrets, credentials, and unrelated personal data.
- Temporary instrumentation uses `LOG_SERVER_PROBE <session_id>` markers.
- Runtime logs remain outside the repository and should not be committed.

Review third-party skills and extensions before installation. Pi extensions run
with the same system permissions as Pi.

## Development

Runtime scripts require Node.js 24 or later and use only Node.js built-ins.

```bash
npm run check
npm test
npx tsc --noEmit                  # type-check extensions against the pi ExtensionAPI
npm pack --dry-run
```

Extension type imports resolve through `@earendil-works/pi-coding-agent`, which
is listed in both `peerDependencies` (runtime, provided by Pi) and
`devDependencies` (local editor/type checking only; never packed).

## Support

Report bugs or request improvements in
[GitHub Issues](https://github.com/wangnan0916/runtime-debug-toolkit/issues).

## License

[MIT](LICENSE)
