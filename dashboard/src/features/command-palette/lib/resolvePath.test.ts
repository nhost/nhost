import { resolvePath } from '@/features/command-palette/lib/resolvePath';
import type { CommandNode } from '@/features/command-palette/types';

const projectNode: CommandNode = {
  id: 'project-graphql',
  title: 'GraphQL',
  kind: 'page',
  path: 'graphql',
  scope: 'project',
};

const orgNode: CommandNode = {
  id: 'org-members',
  title: 'Members',
  kind: 'org',
  path: 'members',
  scope: 'org',
};

describe('resolvePath', () => {
  it('resolves project-scoped paths', () => {
    expect(
      resolvePath(projectNode, { orgSlug: 'acme', appSubdomain: 'app' }),
    ).toBe('/orgs/acme/projects/app/graphql');
  });

  it('resolves org-scoped paths', () => {
    expect(resolvePath(orgNode, { orgSlug: 'acme' })).toBe(
      '/orgs/acme/members',
    );
  });

  it('returns external and docs paths verbatim', () => {
    const docNode: CommandNode = {
      id: 'docs',
      title: 'Docs',
      kind: 'doc',
      path: 'https://docs.nhost.io',
      scope: 'external',
    };

    expect(resolvePath(docNode, {})).toBe('https://docs.nhost.io');
  });

  it('resolves the general settings route', () => {
    expect(
      resolvePath(
        {
          id: 'project-settings-general',
          title: 'General',
          kind: 'setting',
          path: 'settings',
          scope: 'project',
        },
        { orgSlug: 'acme', appSubdomain: 'app' },
      ),
    ).toBe('/orgs/acme/projects/app/settings');
  });

  it('returns undefined for missing scope', () => {
    expect(resolvePath(projectNode, { orgSlug: 'acme' })).toBeUndefined();
    expect(resolvePath(orgNode, {})).toBeUndefined();
  });
});
