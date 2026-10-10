// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import {
  type Location,
  MemoryRouter,
  type NavigateFunction,
  useLocation,
  useNavigate,
} from 'react-router';
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
let location: Location;
let navigate: NavigateFunction;

// Reads the router from inside it, so a test can go back and see where it
// landed.
function History() {
  location = useLocation();
  navigate = useNavigate();
  return null;
}

const button = (label: string): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );

const backLink = (): string | null | undefined =>
  [...container.querySelectorAll('a')]
    .find((link) => link.textContent === 'Other ways to sign in')
    ?.getAttribute('href');

async function toggle(label: string): Promise<void> {
  await act(async () => button(label)?.click());
}

describe('password page, switching modes', () => {
  beforeEach(async () => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
    await act(async () =>
      root.render(
        <MemoryRouter
          initialEntries={['/', '/auth/password?next=%2Fprotected']}
          initialIndex={1}
        >
          <PasswordPage />
          <History />
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

  // A toggle that pushed would leave an entry per click for Back to step
  // through before leaving the page, and one that moved focus would strand a
  // keyboard or screen-reader user at the top of the document.
  it('switches in place, without a history entry or a focus change', async () => {
    const toggleButton = button('I already have an account');
    toggleButton?.focus();

    await toggle('I already have an account');
    await toggle('Create an account');

    expect(document.activeElement).toBe(toggleButton);

    await act(async () => navigate(-1));

    expect(location.pathname).toBe('/');
  });
});
