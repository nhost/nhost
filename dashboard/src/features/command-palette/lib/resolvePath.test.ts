import { resolvePath } from '@/features/command-palette/lib/resolvePath';
import type { CommandNode } from '@/features/command-palette/types';

describe('resolvePath', () => {
  it('returns an unscoped internal absolute path unchanged', () => {
    const accountSettings: CommandNode = {
      id: 'account-settings',
      title: 'Account Settings',
      kind: 'page',
      path: '/account',
    };

    expect(
      resolvePath(accountSettings, {
        orgSlug: 'org-a',
        appSubdomain: 'project-a',
      }),
    ).toBe('/account');
  });
});
