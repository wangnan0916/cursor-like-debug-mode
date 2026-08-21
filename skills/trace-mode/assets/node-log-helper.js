// #region LOG_SERVER_PROBE <session_id> node-log-helper
const LOG_SERVER_SESSION = "<session_id>";
const LOG_SERVER_ENDPOINT = "<LOG_SERVER_URL>/log";
const LOG_SERVER_HTTP = process.getBuiltinModule("node:http");

const logServerLog = (event) => {
  try {
    if (!event || typeof event !== "object" || Array.isArray(event)) return;

    const body = JSON.stringify({
      ...event,
      session: LOG_SERVER_SESSION,
      source: "node",
    });
    const request = LOG_SERVER_HTTP.request(
      LOG_SERVER_ENDPOINT,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
      },
      (response) => response.resume(),
    );
    request.on("error", () => {});
    request.end(body);
  } catch {
    // Temporary logging must never affect product behavior.
  }
};
// #endregion LOG_SERVER_PROBE <session_id>
