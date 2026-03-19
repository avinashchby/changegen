import { describe, it, expect } from 'vitest';
import { parseVersion, determineBump, calculateNextVersion } from './version.js';
import type { ParsedCommit } from './types.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Builds a minimal ParsedCommit for version bump tests. */
function makeCommit(
  type: string,
  isBreaking = false,
): ParsedCommit {
  return {
    hash: 'abc1234',
    type,
    scope: null,
    subject: 'some change',
    body: '',
    isBreaking,
    references: [],
    raw: `abc1234 ${type}: some change`,
  };
}

// ---------------------------------------------------------------------------
// parseVersion
// ---------------------------------------------------------------------------

describe('parseVersion', () => {
  it('parses a valid "1.2.3" string into major, minor, patch components', () => {
    const result = parseVersion('1.2.3');
    expect(result).toEqual({ major: 1, minor: 2, patch: 3 });
  });

  it('parses a version with a "v" prefix', () => {
    const result = parseVersion('v2.10.4');
    expect(result).toEqual({ major: 2, minor: 10, patch: 4 });
  });

  it('parses "0.0.0" correctly', () => {
    const result = parseVersion('0.0.0');
    expect(result).toEqual({ major: 0, minor: 0, patch: 0 });
  });

  it('throws for a string with too few parts', () => {
    expect(() => parseVersion('1.2')).toThrow();
  });

  it('throws for a string with too many parts', () => {
    expect(() => parseVersion('1.2.3.4')).toThrow();
  });

  it('throws for a non-numeric component', () => {
    expect(() => parseVersion('1.x.3')).toThrow();
  });

  it('throws for a completely non-semver string', () => {
    expect(() => parseVersion('not-a-version')).toThrow();
  });

  it('throws for an empty string', () => {
    expect(() => parseVersion('')).toThrow();
  });
});

// ---------------------------------------------------------------------------
// determineBump
// ---------------------------------------------------------------------------

describe('determineBump', () => {
  describe('breaking change → major', () => {
    it('returns "major" when any commit is breaking (via ! marker)', () => {
      const commits = [makeCommit('feat', true), makeCommit('fix')];
      expect(determineBump(commits)).toBe('major');
    });

    it('returns "major" even when there are also feat and fix commits', () => {
      const commits = [makeCommit('fix'), makeCommit('feat'), makeCommit('chore', true)];
      expect(determineBump(commits)).toBe('major');
    });
  });

  describe('feat → minor', () => {
    it('returns "minor" when there is a feat commit but no breaking change', () => {
      const commits = [makeCommit('feat'), makeCommit('fix')];
      expect(determineBump(commits)).toBe('minor');
    });

    it('returns "minor" for feat-only commits', () => {
      expect(determineBump([makeCommit('feat')])).toBe('minor');
    });
  });

  describe('fix only → patch', () => {
    it('returns "patch" when there are only fix commits', () => {
      expect(determineBump([makeCommit('fix')])).toBe('patch');
    });

    it('returns "patch" for non-feat, non-breaking commit types', () => {
      const commits = [makeCommit('chore'), makeCommit('docs'), makeCommit('refactor')];
      expect(determineBump(commits)).toBe('patch');
    });

    it('returns "patch" for an empty commit list', () => {
      expect(determineBump([])).toBe('patch');
    });
  });
});

// ---------------------------------------------------------------------------
// calculateNextVersion
// ---------------------------------------------------------------------------

describe('calculateNextVersion', () => {
  describe('major bump', () => {
    it('increments major and resets minor and patch to 0', () => {
      const commits = [makeCommit('feat', true)];
      const result = calculateNextVersion('1.2.3', commits);
      expect(result.next).toBe('2.0.0');
      expect(result.level).toBe('major');
      expect(result.current).toBe('1.2.3');
    });

    it('strips the "v" prefix from current in the result', () => {
      const commits = [makeCommit('fix', true)];
      const result = calculateNextVersion('v3.0.0', commits);
      expect(result.current).toBe('3.0.0');
      expect(result.next).toBe('4.0.0');
    });
  });

  describe('minor bump', () => {
    it('increments minor and resets patch to 0', () => {
      const commits = [makeCommit('feat')];
      const result = calculateNextVersion('1.2.3', commits);
      expect(result.next).toBe('1.3.0');
      expect(result.level).toBe('minor');
    });
  });

  describe('patch bump', () => {
    it('increments only the patch component', () => {
      const commits = [makeCommit('fix')];
      const result = calculateNextVersion('1.2.3', commits);
      expect(result.next).toBe('1.2.4');
      expect(result.level).toBe('patch');
    });
  });

  describe('reason strings', () => {
    it('sets reason to "breaking change detected" for major bumps', () => {
      const result = calculateNextVersion('1.0.0', [makeCommit('feat', true)]);
      expect(result.reason).toBe('breaking change detected');
    });

    it('sets reason to "new features added" for minor bumps', () => {
      const result = calculateNextVersion('1.0.0', [makeCommit('feat')]);
      expect(result.reason).toBe('new features added');
    });

    it('sets reason to "bug fixes only" for patch bumps', () => {
      const result = calculateNextVersion('1.0.0', [makeCommit('fix')]);
      expect(result.reason).toBe('bug fixes only');
    });
  });
});
