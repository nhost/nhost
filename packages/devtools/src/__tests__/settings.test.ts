import { afterEach, describe, expect, it, jest } from '@jest/globals';
import {
  DEFAULT_SETTINGS,
  parseSettings,
  readHidden,
  readSettings,
  writeHidden,
  writeSettings,
} from '../settings';
import { OFFSET_MAX, OFFSET_MIN } from '../snap';

// Everything below came out of a store the user can edit by hand, so each case
// is really about a bad value never reaching the DOM: an unrecognised edge
// defeats every `[data-edge]` selector, and an offset that is not a number used
// to arrive in the style attribute as `NaN` and put the tab off its edge.
const stored = (settings: Record<string, unknown>) =>
  JSON.stringify({ version: 1, ...settings });

describe('parseSettings', () => {
  it('falls back when there is nothing stored', () => {
    expect(parseSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('')).toEqual(DEFAULT_SETTINGS);
  });

  it('falls back on malformed JSON and on JSON that is not an object', () => {
    expect(parseSettings('{oh no')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('null')).toEqual(DEFAULT_SETTINGS);
    expect(parseSettings('42')).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps a well-formed payload', () => {
    expect(
      parseSettings(stored({ edge: 'top', offset: 25, theme: 'light' })),
    ).toEqual({ edge: 'top', offset: 25, theme: 'light' });
  });

  it('discards a payload written by another version', () => {
    const raw = JSON.stringify({
      version: 999,
      edge: 'top',
      offset: 25,
      theme: 'light',
    });
    expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);

    // The shape the unversioned implementation wrote, the only stored payload
    // that exists on real machines. The version stamp exists for exactly this
    // migration, so a missing `version` has to be discarded, not assumed
    // current.
    expect(
      parseSettings(
        JSON.stringify({ edge: 'top', offset: 25, theme: 'light' }),
      ),
    ).toEqual(DEFAULT_SETTINGS);
  });

  it('replaces an unrecognised edge or theme field by field', () => {
    expect(
      parseSettings(stored({ edge: 'centre', offset: 25, theme: 'neon' })),
    ).toEqual({ ...DEFAULT_SETTINGS, offset: 25 });
  });

  it('replaces an offset that is not a finite number', () => {
    // Raw JSON rather than `stored`: JSON.stringify turns NaN and Infinity into
    // null, which would test the same case three times. `1e999` parses to
    // Infinity, which is what the finiteness guard is for.
    const bad = ['"banana"', 'null', 'true', '{}', '1e999', '-1e999'];
    for (const offset of bad) {
      const raw = `{"version":1,"offset":${offset}}`;
      expect(parseSettings(raw).offset).toBe(DEFAULT_SETTINGS.offset);
    }
  });

  it('clamps an offset that would put the tab in a corner', () => {
    expect(parseSettings(stored({ offset: -40 })).offset).toBe(OFFSET_MIN);
    expect(parseSettings(stored({ offset: 400 })).offset).toBe(OFFSET_MAX);
  });
});

describe('settings persistence', () => {
  afterEach(() => {
    window.localStorage.clear();
    jest.restoreAllMocks();
  });

  it('returns the defaults when the key was never written', () => {
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reads back what it wrote', () => {
    const settings = { edge: 'bottom', offset: 20, theme: 'light' } as const;
    writeSettings(settings);
    expect(readSettings()).toEqual(settings);
  });

  // Private mode makes every storage call throw rather than return null.
  it('survives storage that throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => writeSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe('hidden flag', () => {
  afterEach(() => {
    window.sessionStorage.clear();
    window.history.replaceState({}, '', '/');
    jest.restoreAllMocks();
  });

  it('is off until something hides the toolbar', () => {
    expect(readHidden()).toBe(false);
  });

  it('reads back what it wrote', () => {
    writeHidden(true);
    expect(readHidden()).toBe(true);
    writeHidden(false);
    expect(readHidden()).toBe(false);
  });

  // Hiding the toolbar removes the only control that could bring it back, so
  // the parameter has to clear the flag rather than override it for one read:
  // the second read is the next navigation, without the parameter.
  it('is cleared for good by ?nhost-devtools=true', () => {
    writeHidden(true);
    window.history.replaceState({}, '', '/?nhost-devtools=true');
    expect(readHidden()).toBe(false);

    window.history.replaceState({}, '', '/');
    expect(readHidden()).toBe(false);
  });

  it('ignores any other value of the parameter', () => {
    writeHidden(true);
    window.history.replaceState({}, '', '/?nhost-devtools=1');
    expect(readHidden()).toBe(true);
  });

  it('stays visible when storage throws', () => {
    jest.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });
    jest.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('storage disabled');
    });

    expect(readHidden()).toBe(false);
    expect(() => writeHidden(true)).not.toThrow();
  });
});
