// @vitest-environment happy-dom
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { h, ref } from 'vue';
import ManageLinkedAccounts, {
  type LinkedProvider,
} from '@/app/auth/oauth/linked/ManageLinkedAccounts.vue';
import { click, type Mounted, mountAt, settle } from '@/test/mount';

const refresh = vi.hoisted(() => vi.fn());
const unlinkProvider = vi.hoisted(() => vi.fn());

vi.mock('@/components/useRefresh', () => ({ useRefresh: () => refresh }));
vi.mock('@/app/auth/oauth/linked/actions', () => ({ unlinkProvider }));

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

// The props the page passes; a later render changes them in place, as the
// page does once the list is read again.
const shown = ref({ email: 'user@example.com', list: providers });
let mounted: Mounted | undefined;

async function render({
  email = 'user@example.com',
  list = providers,
} = {}): Promise<void> {
  shown.value = { email, list };
  mounted ??= await mountAt(() =>
    h(ManageLinkedAccounts, {
      providers: shown.value.list,
      email: shown.value.email,
      links: shown.value.list.filter(({ link }) => link).length,
    }),
  );
  await settle();
}

const unlinkButtons = (): HTMLButtonElement[] =>
  [...(mounted?.el.querySelectorAll('button') ?? [])].filter(
    (button) => button.textContent?.trim() === 'Unlink',
  );

const unlinkButton = (): HTMLButtonElement | undefined => unlinkButtons()[0];

describe('manage linked accounts', () => {
  beforeEach(() => {
    refresh.mockReset();
    unlinkProvider.mockReset();
    mounted = undefined;
  });

  // Before the server answers, so it cannot be pressed again while the page
  // is read again.
  it('shows the provider as not linked as soon as it is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    await render();

    await click(unlinkButton());

    expect(unlinkButton()).toBeUndefined();
    expect(
      mounted?.el.querySelector('a[href="/auth/oauth/github/connect"]'),
    ).not.toBeNull();
  });

  // Auth links a provider again by verified email, so Unlink alone doesn't
  // cut it off.
  it('says a provider with the account email links again', async () => {
    await render();

    expect(mounted?.el.textContent).toContain(
      "Unlinking doesn't block a provider whose verified email is user@example.com.",
    );
  });

  // No email, two links: unlinking one leaves the other as the only way in.
  it('holds the last link once the other is unlinked', async () => {
    unlinkProvider.mockReturnValueOnce(new Promise(() => undefined));
    await render({
      email: '',
      list: [
        providers[0] as LinkedProvider,
        {
          ...(providers[1] as LinkedProvider),
          link: { id: 'link-2', since: 'Oct 2, 2026' },
        },
      ],
    });
    expect(unlinkButtons().every((button) => !button.disabled)).toBe(true);

    await click(unlinkButtons()[0]);

    expect(unlinkButtons()).toHaveLength(1);
    expect(unlinkButton()?.disabled).toBe(true);
  });

  // No email, three links: once the unlinked one is gone from the list read
  // again, two remain, so either can still go.
  it('counts an unlinked provider once after the list is read again', async () => {
    unlinkProvider.mockResolvedValueOnce({ success: true });
    const github = providers[0] as LinkedProvider;
    const google = {
      ...(providers[1] as LinkedProvider),
      link: { id: 'link-2', since: 'Oct 2, 2026' },
    };
    const apple: LinkedProvider = {
      id: 'apple',
      name: 'Apple',
      connectHref: '/auth/oauth/apple/connect',
      link: { id: 'link-3', since: 'Oct 3, 2026' },
    };
    await render({ email: '', list: [github, google, apple] });

    await click(unlinkButtons()[0]);
    expect(refresh).toHaveBeenCalledOnce();
    await render({
      email: '',
      list: [{ ...github, link: undefined }, google, apple],
    });

    expect(unlinkButtons()).toHaveLength(2);
    expect(unlinkButtons().every((button) => !button.disabled)).toBe(true);
  });
});
