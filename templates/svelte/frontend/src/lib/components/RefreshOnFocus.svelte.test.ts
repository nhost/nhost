import { render } from '@testing-library/svelte';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RefreshOnFocus from './RefreshOnFocus.svelte';
import { FOCUS_REFRESH_MS, SESSION_DEPENDENCY } from './refreshOnFocus.ts';

const navigation = vi.hoisted(() => ({
  invalidate: vi.fn(async () => undefined),
  refreshAll: vi.fn(async () => undefined),
}));

vi.mock('$app/navigation', () => navigation);

const returnToTab = (): void => {
  window.dispatchEvent(new Event('focus'));
};

// A tab left open never navigates, so coming back to it is what lets the
// server hook see a session revoked from another device.
describe('RefreshOnFocus, returning to the tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    navigation.invalidate.mockClear();
    navigation.refreshAll.mockClear();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('loads a signed-in tab again when it is returned to after a while', async () => {
    render(RefreshOnFocus, { props: { signedIn: true } });
    vi.advanceTimersByTime(FOCUS_REFRESH_MS);

    returnToTab();

    await vi.waitFor(() =>
      expect(navigation.refreshAll).toHaveBeenCalledOnce(),
    );
    // The session's request first, so the queries after it read a fresh one.
    expect(navigation.invalidate).toHaveBeenCalledWith(SESSION_DEPENDENCY);
    expect(navigation.invalidate.mock.invocationCallOrder[0]).toBeLessThan(
      navigation.refreshAll.mock.invocationCallOrder[0] ?? 0,
    );
  });

  it('leaves a tab returned to soon after alone', () => {
    render(RefreshOnFocus, { props: { signedIn: true } });
    vi.advanceTimersByTime(FOCUS_REFRESH_MS - 1000);

    returnToTab();

    expect(navigation.invalidate).not.toHaveBeenCalled();
  });

  it('leaves a signed-out tab alone', () => {
    render(RefreshOnFocus, { props: { signedIn: false } });
    vi.advanceTimersByTime(FOCUS_REFRESH_MS);

    returnToTab();

    expect(navigation.invalidate).not.toHaveBeenCalled();
  });
});
