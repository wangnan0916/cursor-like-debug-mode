# Server Troubleshooting

Read only the branch matching the observed failure.

## Startup

Confirm Node.js 24 or later is active.
Run `start-collector.mjs` in the default sandbox first.
Follow the authorization branch in [`collector.md`](collector.md) after a clear permission or listener error.

## Unhealthy Reuse State

Run the safe wrapper again with the intended session.
It ignores stale state and rejects non-loopback service URLs.
Inspect the printed `HEALTH_URL` before connecting a producer.

## Rejected Event

Confirm the request uses `POST /log` and a JSON object body.
Confirm the `content-type` is `application/json`.
Check session characters and the one MiB body limit.

## Browser Delivery

Inspect mixed-content rules and CSP `connect-src` after a blocked request.
Inspect the `OPTIONS` request after a preflight failure.
Use a same-origin proxy or server-side producer when loopback delivery is prohibited.

## Empty Log

Confirm the producer reached its delivery boundary.
Confirm the endpoint and session match the active server contract.
Remember that `LOG_FILE` appears only after the first accepted event.
