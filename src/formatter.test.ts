import { describe, expect, it } from "vitest";
import {
  format,
  formatJson,
  formatMarkdown,
  formatSlack,
  generateInitialChangelog,
} from "./formatter.js";
import type { ChangelogEntry, CommitGroup, ParsedCommit } from "./types.js";

// ---------------------------------------------------------------------------
// Shared fixtures
// ---------------------------------------------------------------------------

const breakingCommit: ParsedCommit = {
  hash: "aaa0001",
  type: "feat",
  scope: "auth",
  subject: "drop support for legacy tokens",
  body: "Tokens issued before v2 are no longer accepted.",
  isBreaking: true,
  references: ["#101"],
  raw: "feat(auth)!: drop support for legacy tokens",
};

const featCommitWithScope: ParsedCommit = {
  hash: "bbb0002",
  type: "feat",
  scope: "api",
  subject: "add rate limiting",
  body: "",
  isBreaking: false,
  references: [],
  raw: "feat(api): add rate limiting",
};

const featCommitNoScope: ParsedCommit = {
  hash: "ccc0003",
  type: "feat",
  scope: null,
  subject: "initial project scaffold",
  body: "",
  isBreaking: false,
  references: [],
  raw: "feat: initial project scaffold",
};

const fixCommit: ParsedCommit = {
  hash: "ddd0004",
  type: "fix",
  scope: "db",
  subject: "handle null pointer in query builder",
  body: "",
  isBreaking: false,
  references: ["#55"],
  raw: "fix(db): handle null pointer in query builder",
};

const perfCommit: ParsedCommit = {
  hash: "eee0005",
  type: "perf",
  scope: null,
  subject: "cache user lookups",
  body: "",
  isBreaking: false,
  references: [],
  raw: "perf: cache user lookups",
};

const featGroup: CommitGroup = {
  type: "feat",
  label: "Features",
  emoji: "✨",
  commits: [featCommitWithScope, featCommitNoScope],
};

const fixGroup: CommitGroup = {
  type: "fix",
  label: "Bug Fixes",
  emoji: "🐛",
  commits: [fixCommit],
};

const perfGroup: CommitGroup = {
  type: "perf",
  label: "Performance",
  emoji: "⚡",
  commits: [perfCommit],
};

/** Entry that has breaking changes and groups intentionally out of order. */
const fullEntry: ChangelogEntry = {
  version: "2.0.0",
  date: "2026-03-19",
  groups: [fixGroup, perfGroup, featGroup], // deliberately unsorted
  breaking: [breakingCommit],
};

/** Simple entry with no breaking changes, single group. */
const simpleEntry: ChangelogEntry = {
  version: "1.1.0",
  date: "2026-01-10",
  groups: [featGroup],
  breaking: [],
};

/** Minimal patch entry used in multi-entry tests. */
const patchEntry: ChangelogEntry = {
  version: "1.0.1",
  date: "2025-12-01",
  groups: [fixGroup],
  breaking: [],
};

// ---------------------------------------------------------------------------
// formatMarkdown
// ---------------------------------------------------------------------------

describe("formatMarkdown", () => {
  it("produces the correct version/date header", () => {
    const output = formatMarkdown(fullEntry);
    expect(output).toContain("## [2.0.0] - 2026-03-19");
  });

  it("places the breaking changes section before all groups", () => {
    const output = formatMarkdown(fullEntry);
    const breakingIdx = output.indexOf("### 💥 Breaking Changes");
    const featIdx = output.indexOf("### ✨ Features");
    expect(breakingIdx).toBeGreaterThanOrEqual(0);
    expect(breakingIdx).toBeLessThan(featIdx);
  });

  it("renders each breaking commit as a dash-prefixed line", () => {
    const output = formatMarkdown(fullEntry);
    expect(output).toContain("- **auth:** drop support for legacy tokens");
  });

  it("sorts groups by COMMIT_TYPE_CONFIG order (feat < fix < perf)", () => {
    const output = formatMarkdown(fullEntry);
    const featIdx = output.indexOf("### ✨ Features");
    const fixIdx = output.indexOf("### 🐛 Bug Fixes");
    const perfIdx = output.indexOf("### ⚡ Performance");
    expect(featIdx).toBeLessThan(fixIdx);
    expect(fixIdx).toBeLessThan(perfIdx);
  });

  it("bolds a commit scope when present", () => {
    const output = formatMarkdown(simpleEntry);
    expect(output).toContain("- **api:** add rate limiting");
  });

  it("omits bold prefix when scope is null", () => {
    const output = formatMarkdown(simpleEntry);
    expect(output).toContain("- initial project scaffold");
    // The scopeless line must not contain any bold markup
    const scopelessLine = output
      .split("\n")
      .find((l) => l.includes("initial project scaffold"));
    expect(scopelessLine).toBe("- initial project scaffold");
  });

  it("prefixes every commit line with a dash", () => {
    const output = formatMarkdown(simpleEntry);
    const commitLines = output
      .split("\n")
      .filter((l) => l.startsWith("- "));
    expect(commitLines.length).toBeGreaterThan(0);
    for (const line of commitLines) {
      expect(line).toMatch(/^- /);
    }
  });

  it("omits the breaking changes section when there are none", () => {
    const output = formatMarkdown(simpleEntry);
    expect(output).not.toContain("Breaking Changes");
  });

  it("does not end with a trailing blank line", () => {
    const output = formatMarkdown(fullEntry);
    expect(output).not.toMatch(/\n$/);
  });
});

// ---------------------------------------------------------------------------
// formatJson
// ---------------------------------------------------------------------------

describe("formatJson", () => {
  it("returns valid JSON", () => {
    const output = formatJson(fullEntry);
    expect(() => JSON.parse(output)).not.toThrow();
  });

  it("includes the version field", () => {
    const parsed = JSON.parse(formatJson(fullEntry));
    expect(parsed.version).toBe("2.0.0");
  });

  it("includes the date field", () => {
    const parsed = JSON.parse(formatJson(fullEntry));
    expect(parsed.date).toBe("2026-03-19");
  });

  it("includes the groups array", () => {
    const parsed = JSON.parse(formatJson(fullEntry));
    expect(Array.isArray(parsed.groups)).toBe(true);
    expect(parsed.groups.length).toBe(fullEntry.groups.length);
  });

  it("includes the breaking array", () => {
    const parsed = JSON.parse(formatJson(fullEntry));
    expect(Array.isArray(parsed.breaking)).toBe(true);
    expect(parsed.breaking.length).toBe(fullEntry.breaking.length);
  });

  it("preserves all ParsedCommit fields on group commits", () => {
    const parsed = JSON.parse(formatJson(simpleEntry));
    const firstCommit = parsed.groups[0].commits[0];
    const keys: (keyof ParsedCommit)[] = [
      "hash",
      "type",
      "scope",
      "subject",
      "body",
      "isBreaking",
      "references",
      "raw",
    ];
    for (const key of keys) {
      expect(firstCommit).toHaveProperty(key);
    }
  });

  it("is pretty-printed with 2-space indentation", () => {
    const output = formatJson(simpleEntry);
    // A pretty-printed object starts with "{\n  "
    expect(output).toMatch(/^\{\n {2}/);
  });
});

// ---------------------------------------------------------------------------
// formatSlack
// ---------------------------------------------------------------------------

describe("formatSlack", () => {
  it("produces the correct header with *bold* version and date", () => {
    const output = formatSlack(fullEntry);
    expect(output).toContain("*Release v2.0.0* (2026-03-19)");
  });

  it("renders group headers with *bold* Slack syntax", () => {
    const output = formatSlack(simpleEntry);
    expect(output).toContain("*✨ Features*");
  });

  it("uses • bullet prefix for commit lines", () => {
    const output = formatSlack(simpleEntry);
    const bulletLines = output.split("\n").filter((l) => l.startsWith("• "));
    expect(bulletLines.length).toBeGreaterThan(0);
  });

  it("does not use markdown dash prefix for commit lines", () => {
    const output = formatSlack(simpleEntry);
    const dashLines = output.split("\n").filter((l) => /^- /.test(l));
    expect(dashLines.length).toBe(0);
  });

  it("bolds scope using *scope:* Slack syntax", () => {
    const output = formatSlack(simpleEntry);
    expect(output).toContain("• *api:* add rate limiting");
  });

  it("omits scope prefix when scope is null", () => {
    const output = formatSlack(simpleEntry);
    expect(output).toContain("• initial project scaffold");
    const scopelessLine = output
      .split("\n")
      .find((l) => l.includes("initial project scaffold"));
    expect(scopelessLine).toBe("• initial project scaffold");
  });

  it("renders the breaking changes section with *bold* header", () => {
    const output = formatSlack(fullEntry);
    expect(output).toContain("*💥 Breaking Changes*");
  });

  it("places breaking changes before group sections", () => {
    const output = formatSlack(fullEntry);
    const breakingIdx = output.indexOf("*💥 Breaking Changes*");
    const featIdx = output.indexOf("*✨ Features*");
    expect(breakingIdx).toBeGreaterThanOrEqual(0);
    expect(breakingIdx).toBeLessThan(featIdx);
  });

  it("omits the breaking section when there are none", () => {
    const output = formatSlack(simpleEntry);
    expect(output).not.toContain("Breaking Changes");
  });
});

// ---------------------------------------------------------------------------
// format (dispatcher)
// ---------------------------------------------------------------------------

describe("format", () => {
  it('dispatches to formatMarkdown when format is "markdown"', () => {
    const direct = formatMarkdown(simpleEntry);
    const dispatched = format(simpleEntry, "markdown");
    expect(dispatched).toBe(direct);
  });

  it('dispatches to formatJson when format is "json"', () => {
    const direct = formatJson(simpleEntry);
    const dispatched = format(simpleEntry, "json");
    expect(dispatched).toBe(direct);
  });

  it('dispatches to formatSlack when format is "slack"', () => {
    const direct = formatSlack(simpleEntry);
    const dispatched = format(simpleEntry, "slack");
    expect(dispatched).toBe(direct);
  });
});

// ---------------------------------------------------------------------------
// generateInitialChangelog
// ---------------------------------------------------------------------------

describe("generateInitialChangelog", () => {
  it("starts with the # Changelog header", () => {
    const output = generateInitialChangelog([simpleEntry]);
    expect(output).toMatch(/^# Changelog\n/);
  });

  it("includes rendered content for every entry provided", () => {
    const output = generateInitialChangelog([fullEntry, simpleEntry, patchEntry]);
    expect(output).toContain("## [2.0.0] - 2026-03-19");
    expect(output).toContain("## [1.1.0] - 2026-01-10");
    expect(output).toContain("## [1.0.1] - 2025-12-01");
  });

  it("separates multiple entries with a blank line", () => {
    const output = generateInitialChangelog([fullEntry, patchEntry]);
    // Each entry is separated by "\n\n" after the header block
    const v200End = output.indexOf("## [2.0.0]");
    const v101Start = output.indexOf("## [1.0.1]");
    const between = output.slice(v200End, v101Start);
    expect(between).toMatch(/\n\n/);
  });

  it("ends with a newline character", () => {
    const output = generateInitialChangelog([simpleEntry]);
    expect(output).toMatch(/\n$/);
  });

  it("returns only the header when given an empty entry list", () => {
    const output = generateInitialChangelog([]);
    expect(output.trim()).toBe("# Changelog");
  });

  it("preserves entry order as provided (caller-sorted, newest first)", () => {
    const output = generateInitialChangelog([fullEntry, simpleEntry, patchEntry]);
    const idx200 = output.indexOf("## [2.0.0]");
    const idx110 = output.indexOf("## [1.1.0]");
    const idx101 = output.indexOf("## [1.0.1]");
    expect(idx200).toBeLessThan(idx110);
    expect(idx110).toBeLessThan(idx101);
  });
});
