import { fireEvent, render, screen } from '@testing-library/svelte';
import { createRawSnippet } from 'svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import SignOutLink from './SignOutLink.svelte';

const signOut = vi.hoisted(() => vi.fn());
const goto = vi.hoisted(() => vi.fn());

vi.mock('#lib/nhost/actions.remote.ts', () => ({ signOut }));
vi.mock('$app/navigation', () => ({ goto }));

const children = createRawSnippet(() => ({
  render: () => '<span>sign out</span>',
}));

// Each test's pending sign-out is let go when it ends.
let release: VoidFunction = () => undefined;
const held = (): Promise<object> =>
  new Promise((resolve) => {
    release = () => resolve({});
  });

describe('sign-out link', () => {
  beforeEach(() => {
    signOut.mockReset();
    goto.mockReset();
    render(SignOutLink, { props: { children } });
  });

  afterEach(() => {
    release();
  });

  it('signs out once and stays pressed until it is done', async () => {
    signOut.mockReturnValueOnce(held());
    const button = screen.getByRole('button');

    await fireEvent.click(button);
    await fireEvent.click(button);

    expect(signOut).toHaveBeenCalledTimes(1);
    expect((button as HTMLButtonElement).disabled).toBe(true);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  // The home page arrives with every load run again, so the nav drops the
  // session too.
  it('goes home once signed out', async () => {
    signOut.mockResolvedValueOnce({});

    await fireEvent.click(screen.getByRole('button'));

    await vi.waitFor(() =>
      expect(goto).toHaveBeenCalledWith('/', { refreshAll: true }),
    );
  });

  it('stays put and says so when the server cannot be reached', async () => {
    signOut.mockResolvedValueOnce({
      error: 'Could not reach the server. You are still signed in.',
      stillSignedIn: true,
    });

    await fireEvent.click(screen.getByRole('button'));

    expect((await screen.findByRole('alert')).textContent).toContain(
      'still signed in',
    );
    expect(goto).not.toHaveBeenCalled();
  });
});
