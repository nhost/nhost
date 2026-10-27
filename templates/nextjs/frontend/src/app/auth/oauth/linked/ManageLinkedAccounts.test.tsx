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

const render = async ({
  email = 'user@example.com',
  list = providers,
} = {}): Promise<void> => {
  await act(async () =>
    root.render(
      <ManageLinkedAccounts
        providers={list}
        email={email}
        links={list.filter(({ link }) => link).length}
      />,
    ),
  );
};

const unlinkButtons = (): HTMLButtonElement[] =>
  [...container.querySelectorAll('button')].filter(
    (button) => button.textContent === 'Unlink',
  );

const unlinkButton = (): HTMLButtonElement | undefined => unlinkButtons()[0];

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

  // Before the server answers, so it cannot be pressed again while the page
  // is read again.
  it('shows the provider as not linked as soon as it is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    await render();

    await act(async () => unlinkButton()?.click());

    expect(unlinkButton()).toBeUndefined();
    expect(
      container.querySelector('a[href="/auth/oauth/github/connect"]'),
    ).not.toBeNull();
  });

  // No email, two links: unlinking one leaves the other as the only way in.
  it('holds the last link once the other is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    await render({
      email: '',
      list: [
        providers[0],
        { ...providers[1], link: { id: 'link-2', since: 'Oct 2, 2026' } },
      ],
    });
    expect(unlinkButtons().every((button) => !button.disabled)).toBe(true);

    await act(async () => unlinkButtons()[0]?.click());

    expect(unlinkButtons()).toHaveLength(1);
    expect(unlinkButton()?.disabled).toBe(true);
  });
});
