// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordPage from '@/auth/password/route';

vi.mock('@/lib/nhost/AuthProvider', () => ({ useAuth: () => ({ nhost: {} }) }));

// Two entries, so "Other ways to sign in" renders. Neither names a method:
// a fixture that did would fail the delete-method job's grep.
vi.mock('@/signin/methods', () => ({ methods: [{}, {}] }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;

const backLink = (): string | null | undefined =>
  [...container.querySelectorAll('a')]
    .find((link) => link.textContent === 'Other ways to sign in')
    ?.getAttribute('href');

async function toggle(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

describe('password page, switching modes', () => {
  beforeEach(async () => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/auth/password?next=%2Fprotected']}>
          <PasswordPage />
        </MemoryRouter>,
      ),
    );
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  // The back link reads the URL, so a mode the visitor switched to only
  // reaches it through the URL.
  it('sends the back link to the mode the visitor switched to', async () => {
    expect(backLink()).toBe('/signin?next=%2Fprotected');

    await toggle('I already have an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected&intent=sign-in');

    await toggle('Create an account');

    expect(backLink()).toBe('/signin?next=%2Fprotected');
  });
});
