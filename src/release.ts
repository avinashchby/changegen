import { execFile as _execFile } from "node:child_process";
import { promisify } from "node:util";

const execFile = promisify(_execFile);

/** Options controlling the full release workflow. */
export interface ReleaseOptions {
  version: string;
  changelogContent: string;
  changelogPath?: string;
  github: boolean;
}

/**
 * Stages all changes and creates a release commit.
 * Runs `git add -A` followed by `git commit -m "chore(release): v{version}"`.
 */
export async function gitCommitRelease(version: string): Promise<void> {
  await execFile("git", ["add", "-A"]);
  await execFile("git", ["commit", "-m", `chore(release): v${version}`]);
}

/**
 * Creates an annotated git tag for the release.
 * Runs `git tag -a v{version} -m "Release v{version}"`.
 */
export async function gitTagRelease(version: string): Promise<void> {
  await execFile("git", [
    "tag",
    "-a",
    `v${version}`,
    "-m",
    `Release v${version}`,
  ]);
}

/**
 * Creates a GitHub release via the `gh` CLI.
 * Passes release notes as a direct argument.
 */
export async function createGithubRelease(
  version: string,
  notes: string,
): Promise<void> {
  await execFile("gh", [
    "release",
    "create",
    `v${version}`,
    "--title",
    `v${version}`,
    "--notes",
    notes,
  ]);
}

/**
 * Runs the full release workflow:
 * 1. Updates package.json version
 * 2. Prepends changelog entry
 * 3. Creates a git commit
 * 4. Creates a git tag
 * 5. Optionally creates a GitHub release
 */
export async function performRelease(options: ReleaseOptions): Promise<void> {
  const { version, changelogContent, changelogPath, github } = options;

  const { writePackageVersion } = await import("./version.js");
  const { prependToChangelog } = await import("./formatter.js");

  console.log("Updating package.json...");
  await writePackageVersion(version);

  console.log("Updating CHANGELOG...");
  await prependToChangelog(changelogContent, changelogPath);

  console.log("Committing release...");
  await gitCommitRelease(version);

  console.log("Tagging release...");
  await gitTagRelease(version);

  if (github) {
    console.log("Creating GitHub release...");
    await createGithubRelease(version, changelogContent);
  }

  console.log(`Release v${version} complete.`);
}
