// @vitest-environment happy-dom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Passkey } from '@/app/auth/passkey/manage/actions';
import ManagePasskeys from '@/app/auth/passkey/manage/ManagePasskeys.vue';
import {
  passkeysOnThisDevice,
  rememberPasskey,
} from '@/app/auth/passkey/thisDevice';
import { buttonIn, click, type Mounted, mountAt, submit } from '@/test/mount';

const refresh = vi.hoisted(() => vi.fn());

const actions = vi.hoisted(() => ({
  beginAddPasskey: vi.fn(),
  finishAddPasskey: vi.fn(),
  removePasskey: vi.fn(),
}));

const webauthn = vi.hoisted(() => ({
  browserSupportsWebAuthn: vi.fn(() => true),
  startRegistration: vi.fn(),
}));

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/auth/passkey/manage/actions', () => actions);
vi.mock('@simplewebauthn/browser', () => webauthn);

let mounted: Mounted;

const keys = [{ id: 'k1', credentialId: 'c1', nickname: 'laptop' }];

const chromeOnMac =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36';

const nameField = (): HTMLInputElement | null =>
  mounted.el.querySelector('input[type="text"]');

// The dialog's state is set when it opens, so this opens it afresh.
async function open(list: Passkey[]): Promise<void> {
  mounted?.unmount();
  mounted = await mountAt(ManagePasskeys, '/account', {
    props: { keys: list },
  });
}

describe('manage passkeys', () => {
  beforeEach(async () => {
    for (const fn of [
      refresh,
      ...Object.values(actions),
      webauthn.startRegistration,
    ]) {
      fn.mockReset();
    }
    webauthn.browserSupportsWebAuthn.mockReturnValue(true);
    vi.spyOn(navigator, 'userAgent', 'get').mockReturnValue(chromeOnMac);
    localStorage.clear();
    await open(keys);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts the name as the device it is added on', () => {
    expect(nameField()?.value).toBe('Chrome - macOS');
  });

  // Added or used here before, so the device would refuse another.
  it('marks the passkey this browser holds and says so before adding', async () => {
    rememberPasskey('c1');
    await open(keys);

    expect(mounted.el.querySelector('li')?.textContent).toContain(
      'This device',
    );
    expect(mounted.el.textContent).toContain(
      'This browser already has a passkey for your account. To add another, use your phone or a security key.',
    );
    expect(nameField()?.value).toBe('');
  });

  // Options from the first server call, credential into the second, with the
  // browser's step between them.
  it('runs the add ceremony and refreshes the list', async () => {
    const options = { challenge: 'c' };
    const credential = { id: 'new' };
    actions.beginAddPasskey.mockResolvedValueOnce({ options });
    webauthn.startRegistration.mockResolvedValueOnce(credential);
    actions.finishAddPasskey.mockResolvedValueOnce({ success: true });

    await submit(mounted.el.querySelector('form'));

    expect(webauthn.startRegistration).toHaveBeenCalledWith({
      optionsJSON: options,
    });
    expect(actions.finishAddPasskey).toHaveBeenCalledWith(
      credential,
      'Chrome - macOS',
    );
    expect(refresh).toHaveBeenCalled();
    expect(passkeysOnThisDevice().has('new')).toBe(true);
  });

  // Before the server answers, so it cannot be pressed again while the page
  // is read again.
  it('takes the passkey off the list as soon as Remove is pressed', async () => {
    actions.removePasskey.mockReturnValueOnce(new Promise(() => undefined));

    await click(buttonIn(mounted.el, 'Remove'));

    expect(mounted.el.querySelector('li')).toBeNull();
  });
});
