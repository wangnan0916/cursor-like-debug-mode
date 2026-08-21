#!/usr/bin/env node
/**
 * CLI and ensure orchestrator for the local log collector.
 *
 * Two modules, one external contract:
 *   - this file: arg parsing, --ensure orchestration (lock, health polling,
 *     detached child startup), and foreground delegation
 *   - collector-server.mjs: the NDJSON HTTP sink (startCollector) plus the
 *     shared constants, validators, and the service state contract it writes
 *
 * In ensure mode this script spawns itself (without --ensure) as the detached
 * server child; the child process runs startCollector via the same CLI path.
 */

import { spawn } from "node:child_process";
import { mkdir, open, readFile, rm, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import {
  DEFAULT_LOG_DIR,
  DEFAULT_STATE_FILE,
  LOOPBACK_HOSTS,
  isLoopbackUrl,
  printCollectorDetails,
  readStateFile,
  startCollector,
  validateSession,
} from "./collector-server.mjs";

const ENSURE_TIMEOUT_MS = 5000;
const HEALTH_TIMEOUT_MS = 500;
const HEALTH_POLL_INTERVAL_MS = 100;
const STARTUP_ERROR_OUTPUT_LIMIT = 4000;
const SCRIPT_PATH = fileURLToPath(import.meta.url);

function usage() {
  console.log(`Usage: node scripts/log-server.mjs [--ensure] [--dir <path>] [--session <id>] [--port 0] [--host 127.0.0.1] [--state <path>]

Options:
  --ensure    Reuse a healthy shared collector or start one in the background
  --dir       Directory for NDJSON logs. Default: ${DEFAULT_LOG_DIR}
  --session   Session id and log filename stem. Default: dbg-<timestamp>-<random>
  --port      Port to bind. Use 0 for an available port. Default: 0
  --host      Loopback host to bind. Default: 127.0.0.1
  --state     Service discovery state file. Default: ${DEFAULT_STATE_FILE}
  --help      Show this help text
`);
}

function parseArgs(argv) {
  const args = {
    dir: DEFAULT_LOG_DIR,
    session: `dbg-${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${Math.random()
      .toString(36)
      .slice(2, 8)}`,
    port: 0,
    host: "127.0.0.1",
    state: DEFAULT_STATE_FILE,
    ensure: false,
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--help" || arg === "-h") {
      usage();
      process.exit(0);
    }

    if (!arg.startsWith("--")) {
      throw new Error(`Unexpected argument: ${arg}`);
    }

    const key = arg.slice(2);
    if (key === "ensure") {
      args.ensure = true;
      continue;
    }

    const value = argv[i + 1];
    if (!value || value.startsWith("--")) {
      throw new Error(`Missing value for ${arg}`);
    }
    i += 1;

    if (key === "dir") args.dir = value;
    else if (key === "session") args.session = value;
    else if (key === "host") args.host = value;
    else if (key === "state") args.state = value;
    else if (key === "port") {
      const port = Number(value);
      if (!Number.isInteger(port) || port < 0 || port > 65535) {
        throw new Error(`Invalid port: ${value}`);
      }
      args.port = port;
    } else {
      throw new Error(`Unknown option: ${arg}`);
    }
  }

  validateSession(args.session);

  if (!LOOPBACK_HOSTS.has(args.host)) {
    throw new Error(
      `Host must be loopback-only (127.0.0.1, localhost, or ::1). Refusing to bind ${args.host}.`,
    );
  }

  return args;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function startupError(message, stderr) {
  const details = stderr.trim();
  if (!details) return new Error(message);
  return new Error(`${message}\nChild stderr:\n${details}`);
}

async function readStartupOutput(file) {
  try {
    const output = await readFile(file, "utf8");
    return output.slice(-STARTUP_ERROR_OUTPUT_LIMIT);
  } catch {
    return "";
  }
}

async function fetchJson(url, timeoutMs) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) return null;
    return await response.json();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function healthyStateFromResponse(state, body) {
  if (!state || !body || body.ok !== true) return null;
  if (typeof body.pid !== "number" || body.pid !== state.pid) return null;
  if (typeof body.logServerUrl !== "string" || typeof body.logDir !== "string") return null;

  const healthUrl = body.healthUrl || `${body.logServerUrl}/health`;
  if (!isLoopbackUrl(body.logServerUrl) || !isLoopbackUrl(healthUrl)) return null;

  return {
    ...state,
    logServerUrl: body.logServerUrl,
    healthUrl,
    logDir: body.logDir,
    pid: body.pid,
    startedAt: body.startedAt,
  };
}

async function checkStateHealth(stateFile) {
  const state = await readStateFile(stateFile);
  if (!state || typeof state.healthUrl !== "string") return null;
  if (!isLoopbackUrl(state.healthUrl)) return null;
  const body = await fetchJson(state.healthUrl, HEALTH_TIMEOUT_MS);
  return healthyStateFromResponse(state, body);
}

async function waitForHealthyState(stateFile, timeoutMs) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const healthy = await checkStateHealth(stateFile);
    if (healthy) return healthy;
    await sleep(HEALTH_POLL_INTERVAL_MS);
  }
  return null;
}

async function removeStaleLock(lockDir, staleMs) {
  try {
    const stats = await stat(lockDir);
    if (Date.now() - stats.mtimeMs <= staleMs) return false;
    await rm(lockDir, { recursive: true, force: true });
    return true;
  } catch (error) {
    if (error.code === "ENOENT") return true;
    throw error;
  }
}

async function acquireEnsureLock(stateFile, lockDir, timeoutMs) {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    try {
      await mkdir(lockDir, { mode: 0o700 });
      return {
        existing: null,
        release: async () => {
          await rm(lockDir, { recursive: true, force: true });
        },
      };
    } catch (error) {
      if (error.code !== "EEXIST") throw error;

      const existing = await checkStateHealth(stateFile);
      if (existing) {
        return {
          existing,
          release: async () => {},
        };
      }

      if (await removeStaleLock(lockDir, timeoutMs)) continue;
      await sleep(HEALTH_POLL_INTERVAL_MS);
    }
  }

  throw new Error(`Timed out waiting for the log server startup lock: ${lockDir}`);
}

async function startDetachedCollector(args, logDir, stateFile) {
  const startupLogFile = `${stateFile}.startup-${process.pid}-${Date.now()}.log`;
  const startupLog = await open(startupLogFile, "w", 0o600);
  let child;
  try {
    child = spawn(
      process.execPath,
      [
        SCRIPT_PATH,
        "--dir",
        logDir,
        "--session",
        args.session,
        "--host",
        args.host,
        "--port",
        String(args.port),
        "--state",
        stateFile,
      ],
      {
        cwd: process.cwd(),
        detached: true,
        stdio: ["ignore", "ignore", startupLog.fd],
      },
    );
  } finally {
    await startupLog.close().catch(() => {});
  }

  const closePromise = new Promise((resolve) => {
    child.once("close", (code, signal) => {
      resolve({ code, signal });
    });
  });

  const result = await Promise.race([
    waitForHealthyState(stateFile, ENSURE_TIMEOUT_MS).then((healthy) => ({
      type: "healthy",
      healthy,
    })),
    closePromise.then((exit) => ({
      type: "exit",
      exit,
    })),
  ]);

  if (result.type === "healthy" && result.healthy) {
    await rm(startupLogFile, { force: true });
    child.unref();
    return result.healthy;
  }

  if (result.type === "exit") {
    const stderr = await readStartupOutput(startupLogFile);
    await rm(startupLogFile, { force: true });
    child.unref();
    const { code, signal } = result.exit;
    throw startupError(
      `Failed to start the log server: code=${code ?? "null"} signal=${signal ?? "null"}.`,
      stderr,
    );
  }

  try {
    child.kill("SIGTERM");
  } catch {
    // Best effort cleanup for a server that never became discoverable.
  }
  const stderr = await readStartupOutput(startupLogFile);
  await rm(startupLogFile, { force: true });
  child.unref();
  throw startupError("Timed out waiting for the log server to become healthy.", stderr);
}

async function ensureCollector(args) {
  const logDir = path.resolve(args.dir);
  const stateFile = path.resolve(args.state);
  const existing = await checkStateHealth(stateFile);
  if (existing) {
    printCollectorDetails({ ...existing, session: args.session });
    return;
  }

  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  const lock = await acquireEnsureLock(stateFile, `${stateFile}.lock`, ENSURE_TIMEOUT_MS);
  try {
    const lockedExisting = lock.existing ?? (await checkStateHealth(stateFile));
    if (lockedExisting) {
      printCollectorDetails({ ...lockedExisting, session: args.session });
      return;
    }

    await mkdir(logDir, { recursive: true });
    const healthy = await startDetachedCollector(args, logDir, stateFile);
    printCollectorDetails({ ...healthy, session: args.session });
  } finally {
    await lock.release();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  if (args.ensure) {
    await ensureCollector(args);
    return;
  }
  await startCollector(args);
}

main().catch((error) => {
  console.error(error.message || String(error));
  process.exit(1);
});
