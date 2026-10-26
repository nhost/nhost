// @vitest-environment happy-dom
import { act } from 'react';
import { createRoot, type Root } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from '@/app/auth/oauth/linked/ManageLinkedAccounts';

const router = vi.hoisted(() => ({ refresh: vi.fn() }));
const unlinkProvider = vi.hoisted(() => vi.fn());

vi.mock('next/navigation', () => ({ useRouter: () => router }));
vi.mock('@/app/auth/oauth/linked/actions', () => ({ unlinkProvider }));

(
  globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const providers: LinkedProvider[] = [
  {
    id: 'github',
    name: 'GitHub',
    connectHref: '/auth/oauth/github/connect',
    link: { id: 'link-1', since: 'Oct 1, 2026' },
  },
  {
    id: 'google',
    name: 'Google',
    connectHref: '/auth/oauth/google/connect',
  },
];

let container: HTMLElement;
let root: Root;

const render = async (canUnlink = true): Promise<void> => {
  await act(async () =>
    root.render(
      <ManageLinkedAccounts providers={providers} canUnlink={canUnlink} />,
    ),
  );
};

const unlinkButton = (): HTMLButtonElement | undefined =>
  [...container.querySelectorAll('button')].find(
    (button) => button.textContent === 'Unlink',
  );

describe('manage linked accounts', () => {
  beforeEach(() => {
    router.refresh.mockReset();
    unlinkProvider.mockReset();
    container = document.body.appendChild(document.createElement('div'));
    root = createRoot(container);
  });

  afterEach(() => {
    act(() => root.unmount());
    container.remove();
  });

  it('links a provider that is not linked to its connect route', async () => {
    await render();

    expect(
      container.querySelector('a[href="/auth/oauth/google/connect"]')
        ?.textContent,
    ).toBe('Link account');
    expect(container.textContent).toContain('Linked Oct 1, 2026');
  });

  it('unlinks by the link id and reads the list again', async () => {
    unlinkProvider.mockResolvedValueOnce({ success: true });
    await render();

    await act(async () => unlinkButton()?.click());

    expect(unlinkProvider).toHaveBeenCalledWith('link-1');
    expect(router.refresh).toHaveBeenCalledOnce();
  });

  it('says why when the provider stays linked', async () => {
    unlinkProvider.mockResolvedValueOnce({ error: 'stays linked' });
    await render();

    await act(async () => unlinkButton()?.click());

    expect(container.querySelector('[role="alert"]')?.textContent).toBe(
      'stays linked',
    );
    expect(router.refresh).not.toHaveBeenCalled();
  });

  it('holds the last way in and says why', async () => {
    await render(false);

    expect(unlinkButton()?.disabled).toBe(true);
    expect(container.textContent).toContain('no email address');
  });
});
