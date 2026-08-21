import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

import { registerCheckpointTool, type CheckpointSpec } from "./checkpoint.mjs";
import { buildSkillPrompt } from "./skill-prompt.mjs";

const COMMAND_NAME = "trace-mode";
const TOOL_NAME = "trace_mode_checkpoint";
const DEFAULT_REQUEST =
	"Start Trace Mode. Frame the trace from my request, then follow the trace loop.";

const TRACE_CHECKPOINT_SPEC: CheckpointSpec = {
	workflowName: "Trace Mode",
	toolName: TOOL_NAME,
	label: "Trace Mode",
	description:
		"Show one Trace Mode checkpoint for a manual trigger attempt. An active trace session survives replies and retries until cleanup or explicit handoff.",
	promptSnippet: "Show an interactive Trace Mode checkpoint with A, B, and C",
	promptGuidelines: [
		"A trace-mode session remains active until cleanup or explicit handoff, including across user replies and context compaction.",
		"Call trace_mode_checkpoint for every manual trigger attempt, including retries after earlier checkpoint results.",
		"Make it the only tool call in that assistant response. Use plain text only when this tool reports UI unavailable.",
	],
	phases: [{ id: "capture", action: "run the stated trigger" }],
	choices: [
		{ code: "A", label: "A - Trace captured", meaning: "Captured" },
		{ code: "B", label: "B - Could not trigger", meaning: "Not triggered" },
		{ code: "C", label: "C - Other: enter details", meaning: "Other" },
	],
	otherCode: "C",
	endpointLabel: "Trace endpoint",
};

export default function traceMode(pi: ExtensionAPI) {
	// /trace-mode injects the bundled SKILL.md directly (the package no longer loads skills).
	pi.registerCommand(COMMAND_NAME, {
		description: "Start Trace Mode to trace runtime behavior and locate responsible code",
		handler: async (args, ctx) => {
			pi.sendUserMessage(
				buildSkillPrompt(COMMAND_NAME, args, DEFAULT_REQUEST),
				ctx.isIdle() ? undefined : { deliverAs: "steer" },
			);
		},
	});

	registerCheckpointTool(pi, TRACE_CHECKPOINT_SPEC);
}
