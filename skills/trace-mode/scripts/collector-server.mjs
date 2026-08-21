#!/usr/bin/env node
/**
 * Collector sink: the NDJSON HTTP server half of the local log collector.
 *
 * This module is a library. `log-server.mjs` is the CLI and ensure orchestrator;
 * it imports `startCollector` from here for foreground mode, and spawns
 * `log-server.mjs` (without --ensure) as the detached server child.
 *
 * Service state contract (the interface between wrapper and detached child):
 * The server writes one JSON object to the --state path once listening:
 *   {
 *     version:      number,  // SERVICE_VERSION
 *     pid:          number,  // required when a client validates health
 *     host:         string,  // bound loopback host
 *     port:         number,  // bound port
 *     logServerUrl: string,  // required, must be loopback http URL
 *     healthUrl:    string,  // required, must be loopback http URL
 *     logDir:       string,  // required, absolute log directory
 *     stateFile:    string,  // this file's own path
 *     startedAt:    string   // ISO timestamp
 *   }
 * Only pid, logServerUrl, healthUrl, and logDir are trusted after re-validation
 * (see healthyStateFromResponse in log-server.mjs); every other field is informational.
 */

import http from "node:http";
import { appendFile, mkdir, readFile, unlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

export const LOOPBACK_HOSTS = new Set(["127.0.0.1", "localhost", "::1"]);
export const DEFAULT_ROOT = path.join(os.tmpdir(), "local-log-server-skill");
export const DEFAULT_LOG_DIR = path.join(DEFAULT_ROOT, "logs");
export const DEFAULT_STATE_FILE = path.join(DEFAULT_ROOT, "collector.json");
export const SERVICE_VERSION = 1;
export const SESSION_PATTERN = /^[A-Za-z0-9._-]+$/;

const CORS_HEADERS = {
  "access-control-allow-origin": "*",
  "access-control-allow-methods": "GET, POST, OPTIONS",
  "access-control-allow-headers": "content-type",
};

export function validateSession(session) {
  if (typeof session !== "string" || !SESSION_PATTERN.test(session)) {
    const error = new Error("Session may only contain letters, digits, dot, underscore, and hyphen.");
    error.statusCode = 400;
    throw error;
  }
}

export function isLoopbackUrl(value) {
  try {
    const url = new URL(value);
    const hostname = url.hostname.replace(/^\[(.*)\]$/, "$1");
    return url.protocol === "http:" && LOOPBACK_HOSTS.has(hostname);
  } catch {
    return false;
  }
}

export function formatHostForUrl(host) {
  return host.includes(":") ? `[${host}]` : host;
}

export function sessionLogFile(logDir, session) {
  validateSession(session);
  return path.join(logDir, `${session}.ndjson`);
}

function resolveEventSession(body, defaultSession) {
  if (!Object.hasOwn(body, "session")) return defaultSession;
  validateSession(body.session);
  return body.session;
}

async function readJsonBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 1024 * 1024) {
      const error = new Error("Request body too large.");
      error.statusCode = 413;
      throw error;
    }
    chunks.push(chunk);
  }

  if (chunks.length === 0) return {};
  const raw = Buffer.concat(chunks).toString("utf8");
  try {
    return JSON.parse(raw);
  } catch {
    const error = new Error("Body must be valid JSON.");
    error.statusCode = 400;
    throw error;
  }
}

function writeJson(res, statusCode, body) {
  const payload = JSON.stringify(body);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    ...CORS_HEADERS,
  });
  res.end(payload);
}

function writeNoContent(res) {
  res.writeHead(204, CORS_HEADERS);
  res.end();
}

const writeQueues = new Map();

async function drainWriteQueue() {
  await Promise.all([...writeQueues.values()].map((queue) => queue.catch(() => {})));
}

function enqueueWrite(logFile, line) {
  const previous = writeQueues.get(logFile) ?? Promise.resolve();
  const write = previous.then(() => appendFile(logFile, line));
  writeQueues.set(logFile, write.catch(() => {}));
  return write;
}

/** The machine-readable Collector Contract printed alongside the KEY=VALUE lines. */
export function collectorContract({ logServerUrl, healthUrl, logDir, session }) {
  return JSON.stringify({
    logServerUrl,
    sessionId: session,
    logDir,
    logFile: sessionLogFile(logDir, session),
    healthUrl,
  });
}

export function printCollectorDetails({ logServerUrl, healthUrl, logDir, session }) {
  console.log(`LOG_SERVER_URL=${logServerUrl}`);
  console.log(`SESSION_ID=${session}`);
  console.log(`LOG_DIR=${logDir}`);
  console.log(`LOG_FILE=${sessionLogFile(logDir, session)}`);
  console.log(`HEALTH_URL=${healthUrl}`);
  console.log(`COLLECTOR_CONTRACT=${collectorContract({ logServerUrl, healthUrl, logDir, session })}`);
}

export async function writeStateFile(stateFile, state) {
  await mkdir(path.dirname(stateFile), { recursive: true, mode: 0o700 });
  await writeFile(stateFile, `${JSON.stringify(state, null, 2)}\n`, { mode: 0o600 });
}

export async function readStateFile(stateFile) {
  try {
    return JSON.parse(await readFile(stateFile, "utf8"));
  } catch {
    return null;
  }
}

async function removeStateFileIfOwned(stateFile) {
  const state = await readStateFile(stateFile);
  if (!state || state.pid !== process.pid) return;
  await unlink(stateFile).catch(() => {});
}

export async function startCollector(args) {
  const logDir = path.resolve(args.dir);
  const stateFile = path.resolve(args.state);
  const startedAt = new Date().toISOString();
  let serviceInfo = null;

  await mkdir(logDir, { recursive: true });

  const server = http.createServer(async (req, res) => {
    try {
      if (req.method === "OPTIONS") {
        writeNoContent(res);
        return;
      }

      if (req.method === "GET" && req.url === "/health") {
        writeJson(res, 200, {
          ok: true,
          version: SERVICE_VERSION,
          pid: process.pid,
          logServerUrl: serviceInfo?.logServerUrl,
          healthUrl: serviceInfo?.healthUrl,
          logDir,
          startedAt,
          uptimeMs: Date.now() - Date.parse(startedAt),
        });
        return;
      }

      if (req.method !== "POST" || req.url !== "/log") {
        writeJson(res, 404, { ok: false, error: "Use POST /log with a JSON object." });
        return;
      }

      const body = await readJsonBody(req);
      if (!body || Array.isArray(body) || typeof body !== "object") {
        writeJson(res, 400, { ok: false, error: "Body must be a JSON object." });
        return;
      }

      const session = resolveEventSession(body, args.session);
      const logFile = sessionLogFile(logDir, session);
      const event = {
        ...body,
        ts: new Date().toISOString(),
        session,
      };

      await enqueueWrite(logFile, `${JSON.stringify(event)}\n`);
      writeJson(res, 200, { ok: true, session, logFile });
    } catch (error) {
      writeJson(res, error.statusCode || 500, { ok: false, error: error.message || String(error) });
    }
  });

  const shutdown = async (code) => {
    server.close(async () => {
      await drainWriteQueue();
      await removeStateFileIfOwned(stateFile);
      process.exit(code);
    });
  };

  server.on("error", async (error) => {
    await drainWriteQueue();
    console.error(`Failed to start local log server: ${error.message}`);
    process.exit(1);
  });

  for (const [signal, code] of [
    ["SIGINT", 130],
    ["SIGTERM", 143],
  ]) {
    process.on(signal, () => {
      shutdown(code);
    });
  }

  server.listen(args.port, args.host, () => {
    const address = server.address();
    const port = typeof address === "object" && address ? address.port : args.port;
    const logServerUrl = `http://${formatHostForUrl(args.host)}:${port}`;
    const healthUrl = `${logServerUrl}/health`;
    serviceInfo = {
      version: SERVICE_VERSION,
      pid: process.pid,
      host: args.host,
      port,
      logServerUrl,
      healthUrl,
      logDir,
      stateFile,
      startedAt,
    };

    writeStateFile(stateFile, serviceInfo)
      .catch((error) => {
        console.error(`Failed to write local log server state: ${error.message || String(error)}`);
      })
      .finally(() => {
        printCollectorDetails({ logServerUrl, healthUrl, logDir, session: args.session });
      });
  });
}
