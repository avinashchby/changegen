#!/usr/bin/env node

import { Command } from "commander";
import { getGitLog, getLatestTag, groupCommits } from "./parser.js";
import { calculateNextVersion, readPackageVersion } from "./version.js";
import { format, prependToChangelog, generateInitialChangelog } from "./formatter.js";
import { performRelease } from "./release.js";
import type { ChangelogEntry, OutputFormat } from "./types.js";

/** Build a changelog entry from commits since a tag. */
async function buildEntry(since?: string): Promise<ChangelogEntry | null> {
  const tag = since ?? (await getLatestTag());
  const commits = await getGitLog(tag ?? undefined);

  if (commits.length === 0) {
    console.log("No conventional commits found since last release.");
    return null;
  }

  const currentVersion = await readPackageVersion();
  const bump = calculateNextVersion(currentVersion, commits);
  const groups = groupCommits(commits);
  const breaking = commits.filter((c) => c.isBreaking);
  const today = new Date().toISOString().slice(0, 10);

  return {
    version: bump.next,
    date: today,
    groups,
    breaking,
  };
}

/** Main CLI program. */
function createProgram(): Command {
  const program = new Command();

  program
    .name("changegen")
    .description("Auto-generate changelogs from conventional commits")
    .version("0.1.0")
    .option("--release", "Bump version, update changelog, commit, and tag", false)
    .option("--github", "Create GitHub release (requires --release)", false)
    .option("--since <tag>", "Generate changes since specific tag")
    .option("--preview", "Show what would be generated without writing", false)
    .option("--format <type>", "Output format: markdown, json, slack", "markdown")
    .action(async (opts) => {
      await runDefault(opts);
    });

  program
    .command("init")
    .description("Create initial CHANGELOG.md from full git history")
    .action(async () => {
      await runInit();
    });

  return program;
}

/** Default command: generate changelog or perform release. */
async function runDefault(opts: {
  release: boolean;
  github: boolean;
  since?: string;
  preview: boolean;
  format: string;
}): Promise<void> {
  const entry = await buildEntry(opts.since);
  if (!entry) return;

  const outputFormat = opts.format as OutputFormat;
  const content = format(entry, outputFormat);

  if (opts.preview) {
    console.log(content);
    return;
  }

  if (opts.release) {
    const markdownContent = format(entry, "markdown");
    await performRelease({
      version: entry.version,
      changelogContent: markdownContent,
      github: opts.github,
    });
    console.log(`\nReleased v${entry.version}`);
  } else {
    if (outputFormat === "markdown") {
      await prependToChangelog(content);
      console.log(`Updated CHANGELOG.md with unreleased changes.`);
    } else {
      console.log(content);
    }
  }
}

/** Init command: generate full changelog from history. */
async function runInit(): Promise<void> {
  const commits = await getGitLog();
  if (commits.length === 0) {
    console.log("No conventional commits found in history.");
    return;
  }

  const groups = groupCommits(commits);
  const breaking = commits.filter((c) => c.isBreaking);
  const today = new Date().toISOString().slice(0, 10);
  const version = await readPackageVersion();

  const entry: ChangelogEntry = {
    version,
    date: today,
    groups,
    breaking,
  };

  const changelog = generateInitialChangelog([entry]);
  await prependToChangelog(changelog);
  console.log("Created CHANGELOG.md from full git history.");
}

const program = createProgram();
program.parse();
