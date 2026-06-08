import { detectSeverity } from '@/features/orgs/projects/logs/components/LogsBody/severity';

describe('detectSeverity', () => {
  it("returns 'unknown' for an empty string", () => {
    expect(detectSeverity('')).toBe('unknown');
  });

  it("returns 'unknown' when no severity marker is present", () => {
    expect(detectSeverity('plain message with no level')).toBe('unknown');
  });

  describe('logfmt style (level=, lvl=, severity=)', () => {
    it('detects level=', () => {
      expect(detectSeverity('t=2026 level=info msg="hi"')).toBe('info');
    });

    it('detects lvl=', () => {
      expect(detectSeverity('t=2026 lvl=warn msg="hi"')).toBe('warn');
    });

    it('detects severity=', () => {
      expect(detectSeverity('severity=error something')).toBe('error');
    });

    it('only matches at a word boundary', () => {
      expect(detectSeverity('mylevel=info')).toBe('unknown');
    });
  });

  describe('JSON style ("level": "...", "severity": "...")', () => {
    it('detects "level"', () => {
      expect(detectSeverity('{"level":"debug","msg":"hi"}')).toBe('debug');
    });

    it('detects "severity"', () => {
      expect(detectSeverity('{"severity":"error"}')).toBe('error');
    });

    it('tolerates spaces around the colon', () => {
      expect(detectSeverity('{ "level" : "warn" }')).toBe('warn');
    });
  });

  describe('bracket prefix', () => {
    it('detects [ERROR]', () => {
      expect(detectSeverity('[ERROR] something broke')).toBe('error');
    });

    it('detects [info]', () => {
      expect(detectSeverity('[info] starting')).toBe('info');
    });
  });

  describe('uppercase prefix', () => {
    it('detects ERROR:', () => {
      expect(detectSeverity('ERROR: kaboom')).toBe('error');
    });

    it('detects INFO:', () => {
      expect(detectSeverity('INFO: hello')).toBe('info');
    });
  });

  describe('aliases', () => {
    it.each([
      ['fatal', 'error'],
      ['critical', 'error'],
      ['warning', 'warn'],
      ['notice', 'info'],
      ['log', 'info'],
      ['trace', 'debug'],
    ] as const)('maps %s → %s', (input, expected) => {
      expect(detectSeverity(`level=${input}`)).toBe(expected);
    });
  });

  it('is case-insensitive on the keyword', () => {
    expect(detectSeverity('LEVEL=info')).toBe('info');
    expect(detectSeverity('Level=INFO')).toBe('info');
  });

  it("returns 'unknown' for unrecognized severity words", () => {
    expect(detectSeverity('level=unknown')).toBe('unknown');
    expect(detectSeverity('level=verbose')).toBe('unknown');
  });
});
