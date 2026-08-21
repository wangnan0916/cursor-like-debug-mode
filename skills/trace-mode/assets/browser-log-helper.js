// #region LOG_SERVER_PROBE <session_id> browser-log-helper
const LOG_SERVER_SESSION = "<session_id>";
const LOG_SERVER_ENDPOINT = "<LOG_SERVER_URL>/log";

const logServerLog = (event) => {
  try {
    if (!event || typeof event !== "object" || Array.isArray(event)) return;

    const payload = JSON.stringify({
      ...event,
      session: LOG_SERVER_SESSION,
      source: "browser",
    });

    if (navigator.sendBeacon?.(LOG_SERVER_ENDPOINT, payload)) return;

    fetch(LOG_SERVER_ENDPOINT, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => {});
  } catch {
    // Temporary logging must never affect product behavior.
  }
};
// #endregion LOG_SERVER_PROBE <session_id>
