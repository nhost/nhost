import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  NO_TRANSITION_CSS,
  NO_TRANSITION_STYLE_ID,
} from '@/providers/Theme/utils';
import { THEME_STORAGE_KEY } from '@/utils/constants/common';

// public/ is not bundled, so the script duplicates these values.
const themeInitScript = readFileSync(
  resolve(process.cwd(), 'public/theme-init.js'),
  'utf8',
);

function mockPrefersDark(matches: boolean) {
  vi.stubGlobal(
    'matchMedia',
    vi.fn().mockReturnValue({ matches } as MediaQueryList),
  );
}

function runThemeInit() {
  new Function(themeInitScript)();
}

describe('public/theme-init.js', () => {
  afterEach(() => {
    window.localStorage.removeItem(THEME_STORAGE_KEY);
    document.documentElement.classList.remove('light', 'dark');
    document.getElementById(NO_TRANSITION_STYLE_ID)?.remove();
    vi.unstubAllGlobals();
  });

  it('uses the same constants as the app', () => {
    expect(themeInitScript).toContain(`'${THEME_STORAGE_KEY}'`);
    expect(themeInitScript).toContain(`'${NO_TRANSITION_STYLE_ID}'`);
    expect(themeInitScript).toContain(`'${NO_TRANSITION_CSS}'`);
  });

  it('applies the stored preference and disables transitions', () => {
    mockPrefersDark(false);
    window.localStorage.setItem(THEME_STORAGE_KEY, 'dark');

    runThemeInit();

    expect(document.documentElement).toHaveClass('dark');
    expect(document.documentElement).not.toHaveClass('light');
    expect(document.getElementById(NO_TRANSITION_STYLE_ID)).toHaveTextContent(
      NO_TRANSITION_CSS,
    );
  });

  it.each([
    [true, 'dark'],
    [false, 'light'],
  ])(
    'falls back to the system theme (prefers dark: %s)',
    (prefersDark, theme) => {
      mockPrefersDark(prefersDark);
      window.localStorage.setItem(THEME_STORAGE_KEY, 'system');

      runThemeInit();

      expect(document.documentElement).toHaveClass(theme);
    },
  );
});
