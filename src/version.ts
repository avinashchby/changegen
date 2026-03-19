import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { BumpLevel, ParsedCommit, VersionBump } from "./types.js";

/**
 * Parses a semver string like "1.2.3" or "v1.2.3" into its numeric components.
 * Throws if the string is not a valid semver.
 */
export function parseVersion(version: string): {
  major: number;
  minor: number;
  patch: number;
} {
  const stripped = version.startsWith("v") ? version.slice(1) : version;
  const parts = stripped.split(".");

  if (parts.length !== 3) {
    throw new Error(`Invalid semver string: "${version}"`);
  }

  const [major, minor, patch] = parts.map((p) => {
    const n = parseInt(p, 10);
    if (isNaN(n) || n < 0) {
      throw new Error(`Invalid semver component "${p}" in "${version}"`);
    }
    return n;
  });

  return { major, minor, patch };
}

/**
 * Determines the version bump level from a list of parsed commits.
 * - Any breaking change → "major"
 * - Any feat commit → "minor"
 * - Otherwise → "patch"
 */
export function determineBump(commits: ParsedCommit[]): BumpLevel {
  if (commits.some((c) => c.isBreaking)) {
    return "major";
  }
  if (commits.some((c) => c.type === "feat")) {
    return "minor";
  }
  return "patch";
}

/**
 * Calculates the next version given the current version string and a list of
 * parsed commits. Returns a VersionBump with the current version, next version,
 * bump level, and a human-readable reason.
 */
export function calculateNextVersion(
  current: string,
  commits: ParsedCommit[]
): VersionBump {
  const { major, minor, patch } = parseVersion(current);
  const level = determineBump(commits);

  let next: string;
  let reason: string;

  if (level === "major") {
    next = `${major + 1}.0.0`;
    reason = "breaking change detected";
  } else if (level === "minor") {
    next = `${major}.${minor + 1}.0`;
    reason = "new features added";
  } else {
    next = `${major}.${minor}.${patch + 1}`;
    reason = "bug fixes only";
  }

  return { current: current.startsWith("v") ? current.slice(1) : current, next, level, reason };
}

/**
 * Reads the version field from package.json in the given directory.
 * Defaults to process.cwd() if no directory is provided.
 */
export async function readPackageVersion(cwd?: string): Promise<string> {
  const dir = cwd ?? process.cwd();
  const pkgPath = join(dir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  if (typeof pkg["version"] !== "string") {
    throw new Error(`No valid "version" field found in ${pkgPath}`);
  }

  return pkg["version"];
}

/**
 * Updates the version field in package.json in the given directory and writes
 * it back with 2-space indentation and a trailing newline.
 * Defaults to process.cwd() if no directory is provided.
 */
export async function writePackageVersion(
  version: string,
  cwd?: string
): Promise<void> {
  const dir = cwd ?? process.cwd();
  const pkgPath = join(dir, "package.json");
  const raw = await readFile(pkgPath, "utf-8");
  const pkg = JSON.parse(raw) as Record<string, unknown>;

  pkg["version"] = version;

  await writeFile(pkgPath, JSON.stringify(pkg, null, 2) + "\n", "utf-8");
}
