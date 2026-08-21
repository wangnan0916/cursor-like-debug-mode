/**
 * Deep checkpoint module for workflow extensions.
 *
 * One interface, N workflows: each extension passes a spec (phases, choices,
 * naming) and this module absorbs the whole interactive loop — select, the
 * free-form editor behind the "other" choice, retry on empty text, and the
 * cancelled / ui-unavailable fallback results.
 *
 * Choices are defined in code per workflow, never supplied by the model:
 * the tool parameters stay small (session, logFile, endpoint, phase) while
 * the semantics live with the workflow author.
 */

/** @typedef {{code: string, label: string, meaning: string}} CheckpointChoice */
/** @typedef {{id: string, action: string}} CheckpointPhase */
/**
 * @typedef {object} CheckpointSpec
 * @property {string} workflowName        Human name, e.g. "Debug Mode".
 * @property {string} toolName            Registered tool name.
 * @property {string} label               Tool label shown in the UI.
 * @property {string} description         Tool description for the model.
 * @property {string} promptSnippet       Tool promptSnippet.
 * @property {string[]} promptGuidelines  Tool promptGuidelines.
 * @property {CheckpointPhase[]} spec.phases  One entry = no phase param; more = required enum param.
 * @property {CheckpointChoice[]} choices Select options in display order.
 * @property {string} otherCode           Which choice code opens the free-form editor.
 * @property {string} endpointLabel       Field label above the endpoint value, e.g. "Debug endpoint".
 * @property {(params: Record<string, string>) => object} [extraDetails]
 *     Merged into result details when provided.
 */

/** @param {CheckpointSpec} spec */
function buildParameters(spec) {
	const properties = {
		session: { type: "string", description: `${spec.workflowName} collector session ID.` },
		logFile: { type: "string", description: "NDJSON log file that the collector writes." },
		debugEndpoint: { type: "string", description: "Collector POST /log endpoint." },
	};
	const required = ["session", "logFile", "debugEndpoint"];

	if (spec.phases.length > 1) {
		properties.phase = {
			type: "string",
			enum: spec.phases.map((phase) => phase.id),
			description: `The checkpoint phase. ${spec.phases
				.map((phase) => `"${phase.id}" to ${phase.action}`)
				.join("; ")}.`,
		};
		required.unshift("phase");
	}

	return { type: "object", additionalProperties: false, required, properties };
}

/** @param {CheckpointSpec} spec @param {Record<string, string>} params */
function unavailableResult(spec, params, reason) {
	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(
					{
						cancelled: true,
						reason,
						sessionActive: true,
						instruction: `Show the plain-text ${spec.workflowName.toLowerCase()} checkpoint for this attempt. Keep the session active for later interactive checkpoints.`,
					},
					null,
					2,
				),
			},
		],
		details: {
			...params,
			cancelled: true,
			reason,
			sessionActive: true,
			...(spec.extraDetails ? spec.extraDetails(params) : {}),
		},
	};
}

/** @param {CheckpointSpec} spec @param {Record<string, string>} params */
function answeredResult(spec, params, choice, text) {
	const answer = { selection: choice.code, meaning: choice.meaning };
	if (choice.code === spec.otherCode) answer.text = text;

	return {
		content: [
			{
				type: "text",
				text: JSON.stringify(
					{
						...answer,
						sessionActive: true,
						instruction: `Continue the active ${spec.workflowName.toLowerCase()} workflow. A later manual attempt requires a fresh checkpoint call.`,
					},
					null,
					2,
				),
			},
		],
		details: {
			...params,
			cancelled: false,
			selection: choice.code,
			meaning: choice.meaning,
			sessionActive: true,
			...(choice.code === spec.otherCode && text ? { text } : {}),
			...(spec.extraDetails ? spec.extraDetails(params) : {}),
		},
	};
}

/**
 * Register one checkpoint tool described by spec.
 * @param {import("@earendil-works/pi-coding-agent").ExtensionAPI} pi
 * @param {CheckpointSpec} spec
 */
export function registerCheckpointTool(pi, spec) {
	pi.registerTool({
		name: spec.toolName,
		label: spec.label,
		description: spec.description,
		promptSnippet: spec.promptSnippet,
		promptGuidelines: spec.promptGuidelines,
		parameters: buildParameters(spec),
		executionMode: "sequential",

		async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
			if (!ctx.hasUI) return unavailableResult(spec, params, "ui_unavailable");

			const phase =
				spec.phases.find((candidate) => candidate.id === params.phase) ?? spec.phases[0];
			const title = [
				spec.workflowName,
				`Please ${phase.action} manually, then choose the result.`,
				`Session: ${params.session}`,
				`Log file: ${params.logFile}`,
				`${spec.endpointLabel}: ${params.debugEndpoint}`,
			].join("\n");

			while (true) {
				const selected = await ctx.ui.select(
					title,
					spec.choices.map((choice) => choice.label),
				);
				if (!selected) return unavailableResult(spec, params, "cancelled");

				const choice = spec.choices.find((candidate) => candidate.label === selected);
				if (!choice) return unavailableResult(spec, params, "cancelled");
				if (choice.code !== spec.otherCode) return answeredResult(spec, params, choice);

				while (true) {
					const customText = await ctx.ui.editor(`${spec.workflowName} — ${choice.label}`, "");
					if (customText === undefined) break;

					const text = customText.trim();
					if (text) return answeredResult(spec, params, choice, text);
					ctx.ui.notify(`Enter text for option ${choice.code}. Press Esc to return.`, "warning");
				}
			}
		},
	});
}
