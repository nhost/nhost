import type { AfterNavigate } from '@sveltejs/kit';
import { render } from 'svelte/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LinkErrorNotice from '$lib/components/LinkErrorNotice.svelte';

const auth = vi.hoisted(() => ({
  linkError: null as string | null,
  clearLinkError() {
    this.linkError = null;
  },
}));

const navigated = vi.hoisted(() => ({
  callback: undefined as ((navigation: AfterNavigate) => void) | undefined,
}));

vi.mock('$lib/nhost/auth.svelte', () => ({ useAuth: () => auth }));

vi.mock('$app/navigation', () => ({
  afterNavigate: (callback: (navigation: AfterNavigate) => void) => {
    navigated.callback = callback;
  },
}));

// `svelte/server` rather than a DOM, as in `button.test.ts`: it runs the
// component's script and says what it renders, which is all this needs.
const html = (): string => render(LinkErrorNotice).body;

const at = (path: string) => ({ url: new URL(path, 'http://localhost') });

function navigate(type: AfterNavigate['type'], from: string, to: string) {
  navigated.callback?.({
    type,
    from: at(from),
    to: at(to),
  } as unknown as AfterNavigate);
}

describe('LinkErrorNotice', () => {
  beforeEach(() => {
    auth.linkError = 'That sign-in method is not enabled on the backend yet.';
  });

  // A provider that is not enabled comes back to the page it was asked to,
  // and the visitor has to be told why they are still signed out.
  it('says why the redirect did not sign the visitor in', () => {
    const out = html();

    expect(out).toContain('role="alert"');
    expect(out).toContain('not enabled on the backend yet');
  });

  it('renders nothing without an error', () => {
    auth.linkError = null;

    expect(html()).not.toContain('role="alert"');
  });

  it('renders the message as text, not markup', () => {
    auth.linkError = '<img src=x onerror=alert(1)>';

    expect(html()).not.toContain('<img');
  });

  it('goes once the visitor moves on', () => {
    html();
    navigate('link', '/', '/elsewhere');

    expect(auth.linkError).toBeNull();
  });

  // The app starting is reported as a navigation too, and that is not the
  // visitor leaving the page they arrived on.
  it('survives the navigation that brings the visitor in', () => {
    html();
    navigate('enter', '/', '/protected');

    expect(auth.linkError).not.toBeNull();
  });

  // A protected page sends a visitor the link did not sign in to sign-in,
  // which is also where they try again, so the reason still applies.
  it('follows the visitor to sign-in', () => {
    html();
    navigate('goto', '/protected', '/signin?next=%2Fprotected');

    expect(auth.linkError).not.toBeNull();
  });

  it('stays while the visitor is still on the page they arrived on', () => {
    html();
    navigate('goto', '/', '/?tab=1');

    expect(auth.linkError).not.toBeNull();
  });
});
