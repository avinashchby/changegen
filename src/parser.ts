import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { COMMIT_TYPE_CONFIG, type CommitGroup, type ParsedCommit } from './types.js';

const execFileAsync = promisify(execFile);

/** Regex for the conventional commit header: optional `!` for breaking change. */
const HEADER_RE = /^([0-9a-f]{4,})\s+([a-z]+)(?:\(([^)]*)\))?(!)?:\s+(.+)$/;

/** Extracts `#<number>` references from a string. */
function extractReferences(text: string): string[] {
  const matches = text.match(/#\d+/g);
  return matches ?? [];
}

/** Detects a breaking change marker in the commit body. */
function hasBreakingChangeInBody(body: string): boolean {
  return /^BREAKING CHANGE:/m.test(body);
}

/**
 * Parses a single conventional commit message.
 *
 * The raw string must begin with the commit hash followed by the conventional
 * commit header. An optional body may follow after a newline. Returns `null`
 * for commits that do not conform to the conventional commit format.
 *
 * @param raw - Full raw commit string: `<hash> <type>(<scope>): <subject>\n<body>`
 */
export function parseConventionalCommit(raw: string): ParsedCommit | null {
  const lines = raw.trim().split('\n');
  if (lines.length === 0) return null;

  const header = lines[0].trim();
  const match = HEADER_RE.exec(header);
  if (!match) return null;

  const [, hash, type, scope, bangBreaking, subject] = match;
  const body = lines.slice(1).join('\n').trim();

  const isBreaking = bangBreaking === '!' || hasBreakingChangeInBody(body);
  const references = extractReferences(subject + '\n' + body);

  return {
    hash,
    type,
    scope: scope ?? null,
    subject,
    body,
    isBreaking,
    references,
    raw,
  };
}

/**
 * Runs `git log` and returns parsed conventional commits.
 *
 * Uses `---END---` as a record delimiter so multi-line bodies are handled
 * safely. Non-conventional commits are silently filtered out.
 *
 * @param since - Optional git ref (tag or SHA) to use as the lower bound.
 *                When omitted the full history is used.
 */
export async function getGitLog(since?: string): Promise<ParsedCommit[]> {
  const range = since ? `${since}..HEAD` : 'HEAD';
  const format = '%H %s%n%b%n---END---';

  let stdout: string;
  try {
    const result = await execFileAsync('git', [
      'log', range, `--format=${format}`,
    ]);
    stdout = result.stdout;
  } catch {
    return [];
  }

  const records = stdout.split('---END---');
  const commits: ParsedCommit[] = [];

  for (const record of records) {
    const trimmed = record.trim();
    if (!trimmed) continue;
    const parsed = parseConventionalCommit(trimmed);
    if (parsed !== null) {
      commits.push(parsed);
    }
  }

  return commits;
}

/**
 * Returns the most recent git tag reachable from HEAD.
 *
 * Uses `git describe --tags --abbrev=0`. Returns `null` when no tags exist or
 * the command fails for any reason.
 */
export async function getLatestTag(): Promise<string | null> {
  try {
    const { stdout } = await execFileAsync('git', [
      'describe', '--tags', '--abbrev=0',
    ]);
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

/**
 * Groups an array of parsed commits by their conventional commit type.
 *
 * Groups are ordered according to `COMMIT_TYPE_CONFIG`. Types with no commits
 * are omitted. Commits with unknown types are also omitted.
 *
 * @param commits - Flat list of parsed commits to group.
 */
export function groupCommits(commits: ParsedCommit[]): CommitGroup[] {
  const byType = new Map<string, ParsedCommit[]>();

  for (const commit of commits) {
    if (!(commit.type in COMMIT_TYPE_CONFIG)) continue;
    const bucket = byType.get(commit.type) ?? [];
    bucket.push(commit);
    byType.set(commit.type, bucket);
  }

  return Object.entries(COMMIT_TYPE_CONFIG)
    .filter(([type]) => byType.has(type))
    .sort(([, a], [, b]) => a.order - b.order)
    .map(([type, config]) => ({
      type,
      label: config.label,
      emoji: config.emoji,
      commits: byType.get(type)!,
    }));
}
