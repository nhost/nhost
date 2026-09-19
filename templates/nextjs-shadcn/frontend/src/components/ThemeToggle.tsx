'use client';

import { Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { THEME_KEY } from '@/lib/theme';

/** Matches the transition in globals.css, plus a little slack. */
const FADE_MS = 250;

/**
 * Light and dark, on one button.
 *
 * At rest it shows the theme you are in; hovering shows the one you would get,
 * so the button answers "where am I" and "where does this go" without a label.
 *
 * Which icon shows is decided in CSS, not in React state: the `dark` class is
 * already on `<html>` before anything renders, so there is no first paint with
 * the wrong icon and nothing for hydration to disagree about. The four cases
 * resolve by specificity rather than by the order the classes are written, the
 * combined `dark:group-hover:` rules being the most specific of them.
 */
export function ThemeToggle() {
  const toggle = (): void => {
    const root = document.documentElement;

    root.classList.add('theme-transition');
    const isDark = root.classList.toggle('dark');
    window.setTimeout(() => root.classList.remove('theme-transition'), FADE_MS);

    try {
      localStorage.setItem(THEME_KEY, isDark ? 'dark' : 'light');
    } catch {
      // Private browsing can refuse storage; the theme still applies for now.
    }
  };

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={toggle}
      aria-label="Switch between light and dark"
      className="group size-8"
    >
      <span className="relative block size-4">
        <Sun
          aria-hidden="true"
          className="absolute inset-0 size-4 opacity-100 transition-opacity duration-300 ease-in-out group-hover:opacity-0 motion-reduce:transition-none dark:opacity-0 dark:group-hover:opacity-100"
        />
        <Moon
          aria-hidden="true"
          className="absolute inset-0 size-4 opacity-0 transition-opacity duration-300 ease-in-out group-hover:opacity-100 motion-reduce:transition-none dark:opacity-100 dark:group-hover:opacity-0"
        />
      </span>
    </Button>
  );
}
