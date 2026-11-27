// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { MemoryRouter, useLocation } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import PasswordForm from '@/app/auth/password/PasswordForm';

vi.mock('@/app/auth/password/actions', () => ({}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

let container: HTMLElement;
let root: Root;
let url = '';

function Where() {
  const location = useLocation();
  url = `${location.pathname}${location.search}`;
  return null;
}

async function toggle(label: string): Promise<void> {
  const button = [...container.querySelectorAll('button')].find(
    (candidate) => candidate.textContent === label,
  );
  await act(async () => button?.click());
}

// "Other ways to sign in" is built from the URL, so a mode the visitor
// switched to only reaches it through the URL.
describe('password form, switching modes', () => {
  beforeEach(() => {
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('writes the mode it switched to into the URL, keeping next', async () => {
    await act(async () =>
      root.render(
        <MemoryRouter initialEntries={['/auth/password?next=%2Fprotected']}>
          <PasswordForm next="/protected" intent="sign-up" />
          <Where />
        </MemoryRouter>,
      ),
    );

    await toggle('I already have an account');

    expect(url).toBe('/auth/password?next=%2Fprotected&intent=sign-in');

    await toggle('Create an account');

    expect(url).toBe('/auth/password?next=%2Fprotected');
  });
});
