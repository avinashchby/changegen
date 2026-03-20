# changegen

Generate changelogs, bump versions, and cut releases — all from your conventional commits.

## Quick Start

```bash
npx @avinashchby/changegen
```

## What It Does

changegen reads your git history, parses commits that follow the [Conventional Commits](https://www.conventionalcommits.org/) spec, and produces a structured changelog. It automatically determines the next semver version (major/minor/patch) based on what changed — breaking changes force a major bump, `feat` commits trigger minor, everything else is a patch. You can preview output, write it to `CHANGELOG.md`, or go all the way through a full release: version bump in `package.json`, a release commit, an annotated git tag, and an optional GitHub release via the `gh` CLI.

## Features

- Parses conventional commits from `git log`, ignoring non-conforming messages
- Auto-calculates the next semver version from commit types (`feat` → minor, breaking → major)
- Outputs in **Markdown**, **JSON**, or **Slack mrkdwn** format
- Prepends new entries to an existing `CHANGELOG.md` without clobbering history
- `init` command bootstraps a `CHANGELOG.md` from the full git history
- `--preview` flag dry-runs output to stdout without touching any files
- Full release workflow: updates `package.json`, commits, tags, and optionally creates a GitHub release
- Usable as a library — all core functions are exported from the package entry point

## Usage

Preview what the next changelog entry would look like without writing anything:

```bash
npx @avinashchby/changegen --preview
```

Update `CHANGELOG.md` with commits since the last tag (default behavior):

```bash
npx @avinashchby/changegen
```

Generate changelog since a specific tag:

```bash
npx @avinashchby/changegen --since v1.2.0
```

Bump `package.json`, update `CHANGELOG.md`, commit, and tag — all in one step:

```bash
npx @avinashchby/changegen --release
```

Cut a release and also publish it as a GitHub release (requires the `gh` CLI):

```bash
npx @avinashchby/changegen --release --github
```

Output the changelog entry as Slack-formatted text (useful for posting to a channel):

```bash
npx @avinashchby/changegen --format slack --preview
```

Bootstrap a `CHANGELOG.md` from the entire git history:

```bash
npx @avinashchby/changegen init
```

## Example Output

**Markdown** (`CHANGELOG.md` entry):

```markdown
## [1.3.0] - 2026-03-20

### 💥 Breaking Changes
- **api:** remove deprecated /v1 endpoints

### ✨ Features
- **auth:** add OAuth2 support
- support multiple output formats

### 🐛 Bug Fixes
- **cli:** handle missing package.json gracefully
```

**Slack** (`--format slack`):

```
*Release v1.3.0* (2026-03-20)

*💥 Breaking Changes*
• *api:* remove deprecated /v1 endpoints

*✨ Features*
• *auth:* add OAuth2 support
• support multiple output formats
```

## Installation

```bash
npm install -g @avinashchby/changegen
# or
npx @avinashchby/changegen
```

Requires Node.js 18 or later. For `--github` support, install the [GitHub CLI](https://cli.github.com/) and authenticate with `gh auth login`.

## License

MIT
