import { afterEach, describe, expect, it, vi } from 'vitest';
import { clamp, nearestEdge, OFFSET_MAX, OFFSET_MIN } from './snap';
import {
  DEFAULT_SETTINGS,
  isLocalBackend,
  localServiceUrls,
  parseSettings,
  readHidden,
  readSettings,
  writeHidden,
  writeSettings,
} from './useToolbarSettings';

const VW = 1000;
const VH = 800;

describe('nearestEdge', () => {
  it('snaps to the closest edge', () => {
    expect(nearestEdge(10, 400, VW, VH).edge).toBe('left');
    expect(nearestEdge(990, 400, VW, VH).edge).toBe('right');
    expect(nearestEdge(500, 10, VW, VH).edge).toBe('top');
    expect(nearestEdge(500, 790, VW, VH).edge).toBe('bottom');
  });

  it('reports the position along vertical edges as a percentage of height', () => {
    expect(nearestEdge(990, 400, VW, VH).offset).toBe(50);
  });

  it('reports the position along horizontal edges as a percentage of width', () => {
    expect(nearestEdge(250, 10, VW, VH).offset).toBe(25);
  });

  it('keeps the offset away from the corners', () => {
    expect(nearestEdge(998, 40, VW, VH).offset).toBe(OFFSET_MIN);
    expect(nearestEdge(998, 760, VW, VH).offset).toBe(OFFSET_MAX);
  });
});

describe('clamp', () => {
  it('bounds a value to the given range', () => {
    expect(clamp(5, 0, 10)).toBe(5);
    expect(clamp(-3, 0, 10)).toBe(0);
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe('localServiceUrls', () => {
  it('builds the local nhost.run URLs for each service', () => {
    expect(localServiceUrls()).toEqual({
      dashboard: 'https://local.dashboard.local.nhost.run',
      hasura: 'https://local.hasura.local.nhost.run',
      mailhog: 'https://local.mailhog.local.nhost.run',
    });
  });
});

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
      expect(parseSettings(`{"version":1,"offset":${offset}}`).offset).toBe(
        DEFAULT_SETTINGS.offset,
      );
    }
  });

  it('clamps an offset that would put the tab in a corner', () => {
    expect(parseSettings(stored({ offset: -40 })).offset).toBe(OFFSET_MIN);
    expect(parseSettings(stored({ offset: 400 })).offset).toBe(OFFSET_MAX);
  });
});

function fakeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => {
      values.set(key, value);
    },
    removeItem: (key: string) => {
      values.delete(key);
    },
  };
}

// Private mode makes every storage call throw rather than return null.
const throwingStorage = {
  getItem: () => {
    throw new Error('storage disabled');
  },
  setItem: () => {
    throw new Error('storage disabled');
  },
  removeItem: () => {
    throw new Error('storage disabled');
  },
};

function stubWindow(overrides: {
  localStorage?: unknown;
  sessionStorage?: unknown;
  search?: string;
}) {
  vi.stubGlobal('window', {
    localStorage: overrides.localStorage ?? fakeStorage(),
    sessionStorage: overrides.sessionStorage ?? fakeStorage(),
    location: { search: overrides.search ?? '' },
  });
}

describe('settings persistence', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the defaults when the key was never written', () => {
    stubWindow({});
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
  });

  it('reads back what it wrote', () => {
    stubWindow({});
    const settings = { edge: 'bottom', offset: 20, theme: 'light' } as const;
    writeSettings(settings);
    expect(readSettings()).toEqual(settings);
  });

  it('survives storage that throws', () => {
    stubWindow({ localStorage: throwingStorage });
    expect(readSettings()).toEqual(DEFAULT_SETTINGS);
    expect(() => writeSettings(DEFAULT_SETTINGS)).not.toThrow();
  });
});

describe('hidden flag', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is off until something hides the toolbar', () => {
    stubWindow({});
    expect(readHidden()).toBe(false);
  });

  it('reads back what it wrote', () => {
    const sessionStorage = fakeStorage();
    stubWindow({ sessionStorage });
    writeHidden(true);
    expect(readHidden()).toBe(true);
    writeHidden(false);
    expect(readHidden()).toBe(false);
  });

  // Hiding the toolbar removes the only control that could bring it back, so
  // the parameter has to clear the flag rather than override it for one render:
  // the second read is the next navigation, without the parameter.
  it('is cleared for good by ?nhost-devtools=true', () => {
    const sessionStorage = fakeStorage();
    stubWindow({ sessionStorage, search: '?nhost-devtools=true' });
    writeHidden(true);
    expect(readHidden()).toBe(false);

    stubWindow({ sessionStorage });
    expect(readHidden()).toBe(false);
  });

  it('ignores any other value of the parameter', () => {
    const sessionStorage = fakeStorage();
    stubWindow({ sessionStorage, search: '?nhost-devtools=1' });
    writeHidden(true);
    expect(readHidden()).toBe(true);
  });

  it('stays visible when storage throws', () => {
    stubWindow({ sessionStorage: throwingStorage });
    expect(readHidden()).toBe(false);
    expect(() => writeHidden(true)).not.toThrow();
  });
});

// Everything the toolbar links to belongs to `nhost up`, so a development
// build pointed at a deployed backend must not show it: those hostnames do not
// resolve there.
describe('isLocalBackend', () => {
  const region = process.env['NEXT_PUBLIC_NHOST_REGION'];

  afterEach(() => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = region;
  });

  it('is true for the local stack, including when nothing is set', () => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = 'local';
    expect(isLocalBackend()).toBe(true);

    process.env['NEXT_PUBLIC_NHOST_REGION'] = '';
    expect(isLocalBackend()).toBe(true);
  });

  it('is false for a real region', () => {
    process.env['NEXT_PUBLIC_NHOST_REGION'] = 'eu-central-1';
    expect(isLocalBackend()).toBe(false);
  });
});
