import { describe, it, expect } from 'vitest';
import { parseConventionalCommit, groupCommits } from './parser.js';
import type { ParsedCommit } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal ParsedCommit for use in groupCommits tests. */
function makeCommit(type: string, subject = 'some change'): ParsedCommit {
  return {
    hash: 'abc1234',
    type,
    scope: null,
    subject,
    body: '',
    isBreaking: false,
    references: [],
    raw: `abc1234 ${type}: ${subject}`,
  };
}

// ---------------------------------------------------------------------------
// parseConventionalCommit
// ---------------------------------------------------------------------------

describe('parseConventionalCommit', () => {
  describe('valid feat commit', () => {
    it('returns a ParsedCommit with type "feat"', () => {
      const result = parseConventionalCommit('abc1234 feat: add dark mode');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('feat');
      expect(result!.subject).toBe('add dark mode');
      expect(result!.hash).toBe('abc1234');
      expect(result!.scope).toBeNull();
      expect(result!.isBreaking).toBe(false);
    });
  });

  describe('valid fix commit', () => {
    it('returns a ParsedCommit with type "fix"', () => {
      const result = parseConventionalCommit('deadbeef fix: correct off-by-one error');
      expect(result).not.toBeNull();
      expect(result!.type).toBe('fix');
      expect(result!.subject).toBe('correct off-by-one error');
    });
  });

  describe('commit with scope', () => {
    it('captures the scope correctly', () => {
      const result = parseConventionalCommit('abc1234 feat(auth): add OAuth2 support');
      expect(result).not.toBeNull();
      expect(result!.scope).toBe('auth');
      expect(result!.type).toBe('feat');
      expect(result!.subject).toBe('add OAuth2 support');
    });
  });

  describe('commit without scope', () => {
    it('sets scope to null', () => {
      const result = parseConventionalCommit('abc1234 fix: resolve memory leak');
      expect(result).not.toBeNull();
      expect(result!.scope).toBeNull();
    });
  });

  describe('commit with ! breaking change marker', () => {
    it('sets isBreaking to true', () => {
      const result = parseConventionalCommit('abc1234 feat!: remove legacy API');
      expect(result).not.toBeNull();
      expect(result!.isBreaking).toBe(true);
    });

    it('works with a scope and !', () => {
      const result = parseConventionalCommit('abc1234 refactor(core)!: rewrite engine');
      expect(result).not.toBeNull();
      expect(result!.isBreaking).toBe(true);
      expect(result!.scope).toBe('core');
    });
  });

  describe('commit with BREAKING CHANGE in body', () => {
    it('sets isBreaking to true when body starts with BREAKING CHANGE:', () => {
      const raw = [
        'abc1234 feat: migrate config format',
        'BREAKING CHANGE: config file must now use YAML instead of JSON',
      ].join('\n');
      const result = parseConventionalCommit(raw);
      expect(result).not.toBeNull();
      expect(result!.isBreaking).toBe(true);
    });

    it('does not set isBreaking for a body without BREAKING CHANGE', () => {
      const raw = [
        'abc1234 fix: update timeout',
        'This changes the default timeout value.',
      ].join('\n');
      const result = parseConventionalCommit(raw);
      expect(result).not.toBeNull();
      expect(result!.isBreaking).toBe(false);
    });
  });

  describe('references extraction', () => {
    it('extracts #<number> references from the subject', () => {
      const result = parseConventionalCommit('abc1234 fix: resolve crash #42');
      expect(result).not.toBeNull();
      expect(result!.references).toContain('#42');
    });

    it('extracts #<number> references from the body', () => {
      const raw = [
        'abc1234 feat: implement search',
        'Closes #101 and #202',
      ].join('\n');
      const result = parseConventionalCommit(raw);
      expect(result).not.toBeNull();
      expect(result!.references).toContain('#101');
      expect(result!.references).toContain('#202');
    });

    it('returns an empty array when there are no references', () => {
      const result = parseConventionalCommit('abc1234 chore: update dependencies');
      expect(result).not.toBeNull();
      expect(result!.references).toHaveLength(0);
    });
  });

  describe('non-conventional commit', () => {
    it('returns null for a plain commit message', () => {
      const result = parseConventionalCommit('abc1234 Update readme');
      expect(result).toBeNull();
    });

    it('returns null for an empty string', () => {
      const result = parseConventionalCommit('');
      expect(result).toBeNull();
    });

    it('returns null when the header has no hash prefix', () => {
      const result = parseConventionalCommit('feat: add something');
      expect(result).toBeNull();
    });

    it('returns null for a message with an invalid type (uppercase)', () => {
      const result = parseConventionalCommit('abc1234 FEAT: add something');
      expect(result).toBeNull();
    });
  });
});

// ---------------------------------------------------------------------------
// groupCommits
// ---------------------------------------------------------------------------

describe('groupCommits', () => {
  describe('groups by type', () => {
    it('places commits into the correct group', () => {
      const commits = [makeCommit('feat', 'new button'), makeCommit('feat', 'dark mode')];
      const groups = groupCommits(commits);
      expect(groups).toHaveLength(1);
      expect(groups[0].type).toBe('feat');
      expect(groups[0].commits).toHaveLength(2);
    });

    it('creates separate groups for different types', () => {
      const commits = [makeCommit('feat'), makeCommit('fix'), makeCommit('docs')];
      const groups = groupCommits(commits);
      const types = groups.map((g) => g.type);
      expect(types).toContain('feat');
      expect(types).toContain('fix');
      expect(types).toContain('docs');
    });

    it('attaches the correct label and emoji from COMMIT_TYPE_CONFIG', () => {
      const groups = groupCommits([makeCommit('feat')]);
      expect(groups[0].label).toBe('Features');
      expect(groups[0].emoji).toBe('✨');
    });
  });

  describe('correct order', () => {
    it('returns groups sorted by their configured order', () => {
      // Insert out of order: docs (order 3), fix (order 1), feat (order 0)
      const commits = [makeCommit('docs'), makeCommit('fix'), makeCommit('feat')];
      const groups = groupCommits(commits);
      const types = groups.map((g) => g.type);
      expect(types.indexOf('feat')).toBeLessThan(types.indexOf('fix'));
      expect(types.indexOf('fix')).toBeLessThan(types.indexOf('docs'));
    });
  });

  describe('omits unknown types', () => {
    it('silently drops commits whose type is not in COMMIT_TYPE_CONFIG', () => {
      const commits = [makeCommit('unknown'), makeCommit('feat')];
      const groups = groupCommits(commits);
      const types = groups.map((g) => g.type);
      expect(types).not.toContain('unknown');
      expect(types).toContain('feat');
    });

    it('returns an empty array when all commits have unknown types', () => {
      const groups = groupCommits([makeCommit('wip'), makeCommit('hack')]);
      expect(groups).toHaveLength(0);
    });
  });

  describe('omits empty groups', () => {
    it('does not include groups for types that have no commits', () => {
      // Only fix commits — feat group must not appear
      const groups = groupCommits([makeCommit('fix')]);
      const types = groups.map((g) => g.type);
      expect(types).not.toContain('feat');
      expect(types).not.toContain('docs');
    });

    it('returns an empty array when given an empty commit list', () => {
      expect(groupCommits([])).toHaveLength(0);
    });
  });
});
