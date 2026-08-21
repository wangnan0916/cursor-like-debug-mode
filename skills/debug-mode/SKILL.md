---
name: debug-mode
description: Diagnose and fix reproducible runtime bugs with temporary structured logs, root-cause evidence, verification, and cleanup. Use for explicit debug-mode or instrumented debugging requests. Continue active sessions across reproduction replies. Use trace-mode when the goal stops at code location.
---

# Debug Mode

Start a session only when the current user invokes `$debug-mode`, says `debug mode`, or requests instrumented debugging.
Resume whenever an active debug session exists, including after user replies or context compaction.
The session becomes active when Step 3 arms the server.
It ends only after Step 8 cleanup or explicit abandonment.
If neither condition applies, stop before analysis, collection, or instrumentation.

This workflow builds on the sibling [`trace-mode`](../trace-mode/SKILL.md) workflow.
It extends location evidence through correction, verification, and cleanup.
The sibling scripts require Node.js 24 or later.
Codex and Pi can provide interactive checkpoints.

Run this evidence loop:

```text
analyze code -> hypothesize -> trace with trace-mode -> prove -> fix -> verify -> clean
```

Work autonomously through instrumentation.
The first planned user interaction is the reproduction checkpoint.
Reproduction and verification are gates.

Checkpoint invariant: every manual reproduction or verification attempt requires a fresh interactive checkpoint.
A previous checkpoint result authorizes only its current attempt.

## 1. Analyze the Code Path

Start repository legwork from the reported symptom.
Read relevant entry points, handlers, state transitions, existing logs, and recent changes.
Map candidate paths from the user's trigger to the observed outcome.
Write a Bug Card:

- Symptom and expected behavior
- Known trigger, route, command, input, or fixture
- Candidate runtime path and disputed boundaries
- Relevant environment, frequency, changes, and evidence
- Observable acceptance criterion

Record unavailable facts as `unknown`.
Resolve consequential unknowns through code reading or discriminating runtime probes.

**Complete when:** one candidate path links trigger to symptom, and each disputed branch has a named probe boundary.

## 2. Build the Hypothesis Matrix

Write two to five ranked hypotheses before adding probes.
Anchor the matrix in code analysis and available evidence.
Use this shape:

```text
H1 <short cause>
Prediction: <runtime state, path, or timing>
Probe: <event names and code locations>
CONFIRMED when: <specific record condition>
REJECTED when: <specific record condition>
```

A hypothesis without a concrete prediction requires more code reading.
Prefer probes that separate multiple hypotheses.

**Complete when:** every hypothesis has falsifiable conditions and a distinguishing planned probe.

## 3. Trace Through Trace Mode

Read the sibling [`trace-mode`](../trace-mode/SKILL.md) skill.
Use its event planning, server startup, and instrumentation steps with the Bug Card.
Read [`references/probes.md`](references/probes.md) for the debug event extension.
Return here before its standalone trace checkpoint.

This workflow is the caller.
The trace-mode workflow must hand back active probes and the five server values.

**Complete when:** every hypothesis has an active probe and all five server values are known.

## 4. Cross the Reproduction Gate

Read [`references/checkpoints.md`](references/checkpoints.md) before presenting the pre-fix checkpoint.
Execute the pre-fix protocol exactly.
Then wait and route its result through the state table.
Every retry returns through this gate with a new interactive call.

**Complete when:** a valid `A`, `B`, or `C` result has been routed by phase.

## 5. Prove the Cause

After pre-fix `A`, read the current session records in `LOG_FILE` before editing product code.
Confirm that every expected probe is present, then inspect the records in file order and compare the relevant values with each hypothesis prediction.
Classify each hypothesis as `CONFIRMED`, `REJECTED`, or `INCONCLUSIVE`.
Write the evidence report:

```text
H1 <short cause>
Status: CONFIRMED
Evidence: <specific events and values>

H2 <short cause>
Status: REJECTED
Evidence: <specific events and values>

Acceptance: <one observable sentence>
Next action: <smallest correction for the confirmed cause>
```

Missing expected probes block confirmation.
Return to Step 2 when every result is rejected or inconclusive.

**Complete when:** current-run records confirm one explanatory cause, with one observable acceptance criterion.

## 6. Make the Evidence-Bound Fix

Make the smallest change that addresses the confirmed cause.
Keep every probe active.
Change events to `runId: "post-fix"`.
Add a focused regression test when the behavior is automatable.

**Complete when:** each product edit traces to the cause, and post-fix evidence is ready.

## 7. Cross the Verification Gate

Present the post-fix checkpoint from [`references/checkpoints.md`](references/checkpoints.md).
Then wait and route its result through the state table.
Every later verification attempt requires another interactive call.

**Complete when:** the user returns post-fix `B` for the stated acceptance criterion.

## 8. Clean Mechanically

Remove every paired region marked `LOG_SERVER_PROBE <session_id>`.
Search for the session ID, `LOG_SERVER_PROBE`, and both region forms.
Remove copied helpers and all temporary instrumentation.
Delete `LOG_FILE` unless the user requests retained evidence.
Keep the shared server running unless the user requests shutdown.
Run relevant checks and inspect the final diff.

**Complete when:** marker and session searches return zero repository matches, checks pass, and only product changes remain.

## Exception Branch

Read [`references/troubleshooting.md`](references/troubleshooting.md) only when collection, reproduction, or delivery fails.
