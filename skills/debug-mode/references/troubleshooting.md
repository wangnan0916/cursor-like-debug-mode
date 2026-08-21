# Troubleshooting

Read only the branch matching the observed collection failure.

## Empty Log

Confirm that the manual trigger crossed the instrumented boundary.
Confirm that event and collector session IDs match.
Confirm that the endpoint ends with `/log`.
Check `LOG_FILE` for every expected probe and inspect the records in file order.

## Collection or Delivery Failure

Read the sibling [`trace-mode` troubleshooting guide](../../trace-mode/references/troubleshooting.md).
Then inspect extension isolation and the content-script context when relevant.

## Noisy Collection

Move probes closer to the disputed boundary.
Record state changes or sample at a low rate.
Keep enough events to preserve causal ordering.

## Bug Does Not Recur

Request the exact trigger, environment, input data, or a screen recording.
Use pre-fix `B` in the checkpoint state table.
Resume evidence analysis after a successful reproduction.
