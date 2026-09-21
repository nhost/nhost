import { vi } from 'vitest';
import { ThemeSwitcher } from '@/components/common/ThemeSwitcher';
import {
  type ThemePreference,
  ThemePreferenceContext,
} from '@/providers/Theme';
import { render, screen, TestUserEvent } from '@/tests/testUtils';

function renderThemeSwitcher(themePreference: ThemePreference = 'system') {
  const setThemePreference = vi.fn();

  render(
    <ThemePreferenceContext.Provider
      value={{
        themePreference,
        setThemePreference,
        resolvedTheme: themePreference === 'dark' ? 'dark' : 'light',
        storageKey: 'test-theme',
      }}
    >
      <ThemeSwitcher />
    </ThemePreferenceContext.Provider>,
  );

  return { setThemePreference };
}

describe('ThemeSwitcher', () => {
  it('renders the light, dark, and system options', () => {
    renderThemeSwitcher();

    expect(screen.getByRole('radio', { name: 'Light' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'Dark' })).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: 'System' })).toBeInTheDocument();
  });

  it('labels the theme option group', () => {
    renderThemeSwitcher();

    expect(
      screen.getByRole('radiogroup', { name: 'Theme' }),
    ).toBeInTheDocument();
  });

  it('marks the active preference as checked', () => {
    renderThemeSwitcher('dark');

    expect(screen.getByRole('radio', { name: 'Dark' })).toBeChecked();
    expect(screen.getByRole('radio', { name: 'Light' })).not.toBeChecked();
  });

  it('updates the preference when a different option is selected', async () => {
    const user = new TestUserEvent();
    const { setThemePreference } = renderThemeSwitcher('system');

    await user.click(screen.getByRole('radio', { name: 'Light' }));

    expect(setThemePreference).toHaveBeenCalledWith('light');
  });

  it('does not clear the preference when the active option is clicked', async () => {
    const user = new TestUserEvent();
    const { setThemePreference } = renderThemeSwitcher('system');

    await user.click(screen.getByRole('radio', { name: 'System' }));

    expect(setThemePreference).not.toHaveBeenCalled();
  });
});
