// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import RefreshOnSessionChange, {
  FOCUS_REFRESH_MS,
} from '@/components/RefreshOnSessionChange';
import { ACCESS_TOKEN_KEY } from '@/lib/nhost/access-token';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const pathname = vi.hoisted(() => ({ current: '/' }));

vi.mock('next/navigation', () => ({
  useRouter: () => router,
  usePathname: () => pathname.current,
}));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const accessTokenCookie = `${ACCESS_TOKEN_KEY}=${encodeURIComponent(
  JSON.stringify({ accessToken: 'token', decodedToken: { exp: 0 } }),
)}`;

function setAccessTokenCookie(present: boolean): void {
  vi.spyOn(document, 'cookie', 'get').mockReturnValue(
    present ? accessTokenCookie : '',
  );
}

let container: HTMLElement;
let root: Root;

async function render(signedIn: boolean, path = '/'): Promise<void> {
  pathname.current = path;
  await act(async () =>
    root.render(<RefreshOnSessionChange signedIn={signedIn} />),
  );
}

describe('RefreshOnSessionChange', () => {
  beforeEach(() => {
    router.refresh.mockReset();
    setAccessTokenCookie(false);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
  });

  it('leaves a nav that matches the session alone', async () => {
    await render(false);
    setAccessTokenCookie(true);
    await render(true, '/account');

    expect(router.refresh).not.toHaveBeenCalled();
  });

  // Signed out in another tab: the next page renders with no session, but
  // the nav in the root layout still shows the avatar.
  it('refreshes when the session ended since the nav rendered', async () => {
    setAccessTokenCookie(true);
    await render(true);

    setAccessTokenCookie(false);
    await render(true, '/account');

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('refreshes when a session started since the nav rendered', async () => {
    await render(false);

    setAccessTokenCookie(true);
    await render(false, '/account');

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  // A refresh that comes back with the same answer must not start another.
  it('does not refresh again on the same path', async () => {
    setAccessTokenCookie(true);
    await render(false);
    await render(false);

    expect(router.refresh).toHaveBeenCalledOnce();
  });
});

// A tab left open never navigates, so coming back to it is what lets the
// proxy see a session revoked from another device.
describe('RefreshOnSessionChange, returning to the tab', () => {
  beforeEach(() => {
    vi.useFakeTimers({ toFake: ['Date'] });
    router.refresh.mockReset();
    setAccessTokenCookie(true);
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  const returnToTab = (): void => {
    act(() => {
      window.dispatchEvent(new Event('focus'));
    });
  };

  it('refreshes a signed-in tab returned to after a while', async () => {
    await render(true);
    vi.advanceTimersByTime(FOCUS_REFRESH_MS);
    returnToTab();

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('does not refresh on a quick return', async () => {
    await render(true);
    vi.advanceTimersByTime(FOCUS_REFRESH_MS - 1);
    returnToTab();

    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('waits the interval again after a refresh', async () => {
    await render(true);
    vi.advanceTimersByTime(FOCUS_REFRESH_MS);
    returnToTab();
    returnToTab();

    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('leaves a signed-out tab alone', async () => {
    setAccessTokenCookie(false);
    await render(false);
    vi.advanceTimersByTime(FOCUS_REFRESH_MS);
    returnToTab();

    expect(router.refresh).not.toHaveBeenCalled();
  });
});
