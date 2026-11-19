import { fireEvent, render, screen } from '@testing-library/svelte';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from './ManageLinkedAccounts.svelte';

const refreshAll = vi.hoisted(() => vi.fn());
const unlinkProvider = vi.hoisted(() => vi.fn());

vi.mock('$app/navigation', () => ({ refreshAll }));
vi.mock('./actions.remote.ts', () => ({ unlinkProvider }));

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

const props = ({
  email = 'user@example.com',
  list = providers,
}: {
  email?: string;
  list?: LinkedProvider[];
} = {}) => ({
  providers: list,
  email,
  links: list.filter(({ link }) => link).length,
});

const unlinkButtons = (): HTMLButtonElement[] =>
  screen.queryAllByRole('button', { name: 'Unlink' }) as HTMLButtonElement[];

describe('manage linked accounts', () => {
  beforeEach(() => {
    refreshAll.mockReset();
    unlinkProvider.mockReset();
  });

  // Before the server answers, so it cannot be pressed again while the page
  // loads again.
  it('shows the provider as not linked as soon as it is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    render(ManageLinkedAccounts, { props: props() });

    await fireEvent.click(unlinkButtons()[0] as HTMLButtonElement);

    expect(unlinkButtons()).toHaveLength(0);
    expect(
      document.querySelector('a[href="/auth/oauth/github/connect"]'),
    ).not.toBeNull();
  });

  // Auth links a provider again by verified email, so Unlink alone doesn't
  // cut it off.
  it('says a provider with the account email links again', () => {
    render(ManageLinkedAccounts, { props: props() });

    expect(document.body.textContent?.replace(/\s+/g, ' ')).toContain(
      "Unlinking doesn't block a provider whose verified email is user@example.com.",
    );
  });

  // No email, two links: unlinking one leaves the other as the only way in.
  it('holds the last link once the other is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    render(ManageLinkedAccounts, {
      props: props({
        email: '',
        list: [
          providers[0],
          { ...providers[1], link: { id: 'link-2', since: 'Oct 2, 2026' } },
        ],
      }),
    });
    expect(unlinkButtons().every((button) => !button.disabled)).toBe(true);

    await fireEvent.click(unlinkButtons()[0] as HTMLButtonElement);

    expect(unlinkButtons()).toHaveLength(1);
    expect(unlinkButtons()[0]?.disabled).toBe(true);
  });

  // No email, three links, one unlinked and the list read again: the two left
  // can each still go.
  it('counts an unlinked provider once after the list is read again', async () => {
    unlinkProvider.mockResolvedValueOnce({ success: true });
    const google = {
      ...providers[1],
      link: { id: 'link-2', since: 'Oct 2, 2026' },
    };
    const apple: LinkedProvider = {
      id: 'apple',
      name: 'Apple',
      connectHref: '/auth/oauth/apple/connect',
      link: { id: 'link-3', since: 'Oct 3, 2026' },
    };
    const { rerender } = render(ManageLinkedAccounts, {
      props: props({ email: '', list: [providers[0], google, apple] }),
    });

    await fireEvent.click(unlinkButtons()[0] as HTMLButtonElement);
    await vi.waitFor(() => expect(refreshAll).toHaveBeenCalledOnce());
    await rerender(
      props({
        email: '',
        list: [{ ...providers[0], link: undefined }, google, apple],
      }),
    );

    expect(unlinkButtons()).toHaveLength(2);
    expect(unlinkButtons().every((button) => !button.disabled)).toBe(true);
  });
});
