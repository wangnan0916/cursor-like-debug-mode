import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const EXTENSIONS_DIR = dirname(fileURLToPath(import.meta.url));
export const SKILLS_DIR = resolve(EXTENSIONS_DIR, "../skills");

export function stripFrontmatter(source) {
	return source.replace(/^---\r?\n[\s\S]*?\r?\n---(?:\r?\n|$)/, "").trim();
}

/**
 * Build a prompt that injects a bundled SKILL.md (frontmatter stripped) plus the user request.
 * @param {string} skillName directory name under skills/ (also the skill name)
 * @param {string} args arguments typed after the slash command
 * @param {string} [fallbackRequest] used when args is empty
 */
export function buildSkillPrompt(skillName, args, fallbackRequest) {
	const skillPath = resolve(SKILLS_DIR, skillName, "SKILL.md");
	const body = stripFrontmatter(readFileSync(skillPath, "utf8"));
	const request = args.trim() || fallbackRequest || `Start ${skillName}.`;
	return `<skill name="${skillName}" location="${skillPath}">\nReferences are relative to ${dirname(skillPath)}.\n\n${body}\n</skill>\n\n${request}`;
}
