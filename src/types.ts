/** Conventional commit types and their display config. */
export const COMMIT_TYPE_CONFIG: Record<string, { label: string; emoji: string; order: number }> = {
  feat: { label: "Features", emoji: "✨", order: 0 },
  fix: { label: "Bug Fixes", emoji: "🐛", order: 1 },
  perf: { label: "Performance", emoji: "⚡", order: 2 },
  docs: { label: "Documentation", emoji: "📚", order: 3 },
  refactor: { label: "Refactoring", emoji: "♻️", order: 4 },
  test: { label: "Tests", emoji: "✅", order: 5 },
  build: { label: "Build", emoji: "📦", order: 6 },
  ci: { label: "CI", emoji: "🔧", order: 7 },
  chore: { label: "Chores", emoji: "🧹", order: 8 },
  style: { label: "Style", emoji: "💅", order: 9 },
  revert: { label: "Reverts", emoji: "⏪", order: 10 },
};

/** A parsed conventional commit. */
export interface ParsedCommit {
  hash: string;
  type: string;
  scope: string | null;
  subject: string;
  body: string;
  isBreaking: boolean;
  references: string[];
  raw: string;
}

/** Grouped commits by type for changelog generation. */
export interface CommitGroup {
  type: string;
  label: string;
  emoji: string;
  commits: ParsedCommit[];
}

/** Version bump level. */
export type BumpLevel = "major" | "minor" | "patch";

/** Result of version calculation. */
export interface VersionBump {
  current: string;
  next: string;
  level: BumpLevel;
  reason: string;
}

/** Changelog entry for a single release. */
export interface ChangelogEntry {
  version: string;
  date: string;
  groups: CommitGroup[];
  breaking: ParsedCommit[];
}

/** Supported output formats. */
export type OutputFormat = "markdown" | "json" | "slack";

/** CLI options. */
export interface CliOptions {
  release: boolean;
  github: boolean;
  since?: string;
  preview: boolean;
  format: OutputFormat;
}
