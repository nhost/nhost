import { afterEach, describe, expect, it } from 'vitest';
import { ThemeProvider } from '@/components/ui/v2/ThemeProvider';
import { cleanup, render, screen, waitFor } from '@/tests/testUtils';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';

describe('ThemeProvider', () => {
  afterEach(() => {
    cleanup();
    localStorage.clear();
    document.documentElement.className = '';
  });

  it('applies the stored color preference to the <html> element', async () => {
    localStorage.setItem(COLOR_PREFERENCE_STORAGE_KEY, 'dark');

    render(
      <ThemeProvider>
        <span>app</span>
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    );
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('scopes a manual color to a wrapper element instead of <html>', async () => {
    document.documentElement.classList.add('dark');

    render(
      <ThemeProvider color="dark">
        <span>signin</span>
      </ThemeProvider>,
    );

    const child = await screen.findByText('signin');
    expect(child.parentElement).toHaveClass('dark', 'contents');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });

  it('keeps the root preference on <html> when a scoped provider mounts later', async () => {
    localStorage.setItem(COLOR_PREFERENCE_STORAGE_KEY, 'dark');

    const { rerender } = render(
      <ThemeProvider>
        <span>app</span>
      </ThemeProvider>,
    );

    await waitFor(() =>
      expect(document.documentElement.classList.contains('dark')).toBe(true),
    );

    rerender(
      <ThemeProvider>
        <ThemeProvider color="dark">
          <span>signin</span>
        </ThemeProvider>
      </ThemeProvider>,
    );

    await screen.findByText('signin');
    expect(document.documentElement.classList.contains('dark')).toBe(true);
    expect(document.documentElement.classList.contains('light')).toBe(false);
  });
});
