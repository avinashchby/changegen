import { readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import {
  COMMIT_TYPE_CONFIG,
  type ChangelogEntry,
  type CommitGroup,
  type OutputFormat,
  type ParsedCommit,
} from "./types.js";

const BREAKING_SECTION_HEADER = "💥 Breaking Changes";
const DEFAULT_CHANGELOG_PATH = "CHANGELOG.md";
const CHANGELOG_HEADER = "# Changelog\n";

/** Renders a single commit line with optional scope bolded. */
function renderCommitLine(commit: ParsedCommit): string {
  const prefix = commit.scope ? `**${commit.scope}:** ` : "";
  return `- ${prefix}${commit.subject}`;
}

/** Renders a single commit bullet for Slack with optional scope bolded. */
function renderSlackCommitLine(commit: ParsedCommit): string {
  const prefix = commit.scope ? `*${commit.scope}:* ` : "";
  return `• ${prefix}${commit.subject}`;
}

/** Sorts CommitGroups by their COMMIT_TYPE_CONFIG order. */
function sortedGroups(groups: CommitGroup[]): CommitGroup[] {
  return [...groups].sort((a, b) => {
    const orderA = COMMIT_TYPE_CONFIG[a.type]?.order ?? 99;
    const orderB = COMMIT_TYPE_CONFIG[b.type]?.order ?? 99;
    return orderA - orderB;
  });
}

/**
 * Formats a changelog entry as a Markdown string.
 * Breaking changes section always appears first, followed by groups
 * sorted by COMMIT_TYPE_CONFIG order.
 */
export function formatMarkdown(entry: ChangelogEntry): string {
  const lines: string[] = [`## [${entry.version}] - ${entry.date}`, ""];

  if (entry.breaking.length > 0) {
    lines.push(`### ${BREAKING_SECTION_HEADER}`);
    for (const commit of entry.breaking) {
      lines.push(renderCommitLine(commit));
    }
    lines.push("");
  }

  for (const group of sortedGroups(entry.groups)) {
    const config = COMMIT_TYPE_CONFIG[group.type];
    const emoji = config?.emoji ?? "";
    lines.push(`### ${emoji} ${group.label}`);
    for (const commit of group.commits) {
      lines.push(renderCommitLine(commit));
    }
    lines.push("");
  }

  // Remove trailing blank line
  if (lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
}

/**
 * Formats a changelog entry as a pretty-printed JSON string.
 */
export function formatJson(entry: ChangelogEntry): string {
  return JSON.stringify(entry, null, 2);
}

/**
 * Formats a changelog entry using Slack mrkdwn syntax.
 * Uses *bold* for headers and • for bullets.
 */
export function formatSlack(entry: ChangelogEntry): string {
  const lines: string[] = [`*Release v${entry.version}* (${entry.date})`, ""];

  if (entry.breaking.length > 0) {
    lines.push(`*${BREAKING_SECTION_HEADER}*`);
    for (const commit of entry.breaking) {
      lines.push(renderSlackCommitLine(commit));
    }
    lines.push("");
  }

  for (const group of sortedGroups(entry.groups)) {
    const config = COMMIT_TYPE_CONFIG[group.type];
    const emoji = config?.emoji ?? "";
    lines.push(`*${emoji} ${group.label}*`);
    for (const commit of group.commits) {
      lines.push(renderSlackCommitLine(commit));
    }
    lines.push("");
  }

  if (lines[lines.length - 1] === "") lines.pop();

  return lines.join("\n");
}

/**
 * Dispatches formatting to the appropriate formatter based on outputFormat.
 */
export function format(entry: ChangelogEntry, outputFormat: OutputFormat): string {
  switch (outputFormat) {
    case "markdown":
      return formatMarkdown(entry);
    case "json":
      return formatJson(entry);
    case "slack":
      return formatSlack(entry);
  }
}

/**
 * Prepends rendered content to a CHANGELOG.md file.
 * If the file doesn't exist, it is created with a `# Changelog` header.
 * New content is inserted after the header line.
 */
export async function prependToChangelog(
  content: string,
  filePath?: string,
): Promise<void> {
  const target = resolve(filePath ?? DEFAULT_CHANGELOG_PATH);
  let existing: string;

  try {
    existing = await readFile(target, "utf8");
  } catch {
    // File does not exist — create from scratch
    await writeFile(target, `${CHANGELOG_HEADER}\n${content}\n`, "utf8");
    return;
  }

  const headerIndex = existing.indexOf(CHANGELOG_HEADER);
  if (headerIndex === -1) {
    // Header not found — prepend header + content before whatever is there
    await writeFile(target, `${CHANGELOG_HEADER}\n${content}\n\n${existing}`, "utf8");
    return;
  }

  const afterHeader = headerIndex + CHANGELOG_HEADER.length;
  const before = existing.slice(0, afterHeader);
  const after = existing.slice(afterHeader).replace(/^\n+/, "");
  await writeFile(target, `${before}\n${content}\n\n${after}`, "utf8");
}

/**
 * Generates a complete CHANGELOG.md string from multiple entries.
 * Intended for the `init` command to produce an initial changelog.
 * Entries are written in the order provided (caller should sort newest-first).
 */
export function generateInitialChangelog(entries: ChangelogEntry[]): string {
  const sections = entries.map((entry) => formatMarkdown(entry));
  return `${CHANGELOG_HEADER}\n${sections.join("\n\n")}\n`;
}
