import {
  getEffectiveScope,
  getFallbackProject,
  withProjectFallbackHint,
} from '@/features/command-palette/lib/fallback';
import type {
  CommandNode,
  PaletteOrg,
  RecentEntry,
} from '@/features/command-palette/types';

const makeEntry = (overrides: Partial<RecentEntry>): RecentEntry => ({
  nodeId: 'project-logs',
  title: 'Logs',
  path: 'logs',
  accessedAt: 1,
  ...overrides,
});

const orgs: PaletteOrg[] = [
  {
    slug: 'org-a',
    name: 'Org A',
    apps: [
      { name: 'Project A', subdomain: 'project-a' },
      { name: 'Project B', subdomain: 'project-b' },
    ],
  },
  {
    slug: 'org-b',
    name: 'Org B',
    apps: [{ name: 'Project C', subdomain: 'project-c' }],
  },
];

const emptyOrg: PaletteOrg = { slug: 'empty', name: 'Empty', apps: [] };

const projectPage: CommandNode = {
  id: 'project-logs',
  title: 'Logs',
  kind: 'page',
  path: 'logs',
  scope: 'project',
};

const orgPage: CommandNode = {
  id: 'org-members',
  title: 'Members',
  kind: 'org',
  path: 'members',
  scope: 'org',
};

const fallback = {
  orgSlug: 'org-b',
  appSubdomain: 'project-c',
  orgName: 'Org B',
  projectName: 'Project C',
};

describe('getFallbackProject', () => {
  it('prefers the most recent entry whose project still exists', () => {
    const recent = [
      makeEntry({ orgSlug: 'org-a', appSubdomain: 'deleted-project' }),
      makeEntry({ orgSlug: 'org-b', appSubdomain: 'project-c' }),
      makeEntry({ orgSlug: 'org-a', appSubdomain: 'project-a' }),
    ];

    expect(getFallbackProject(recent, orgs, 'org-a')).toEqual(fallback);
  });

  it('skips org-scoped entries without a project', () => {
    const recent = [makeEntry({ orgSlug: 'org-b', appSubdomain: undefined })];

    expect(getFallbackProject(recent, orgs, 'org-a')?.appSubdomain).toBe(
      'project-a',
    );
  });

  it('falls back to the current org first project, then any org with projects', () => {
    expect(getFallbackProject([], orgs, 'org-b')?.appSubdomain).toBe(
      'project-c',
    );
    expect(getFallbackProject([], orgs, undefined)?.appSubdomain).toBe(
      'project-a',
    );
    expect(
      getFallbackProject([], [emptyOrg, orgs[1]], 'empty')?.appSubdomain,
    ).toBe('project-c');
  });

  it('returns undefined without any projects', () => {
    expect(getFallbackProject([], [], undefined)).toBeUndefined();
    expect(getFallbackProject([], [emptyOrg], 'empty')).toBeUndefined();
  });
});

describe('getEffectiveScope', () => {
  it('substitutes the fallback pair wholesale for project pages without a route project', () => {
    expect(
      getEffectiveScope(projectPage, { orgSlug: 'org-a' }, fallback),
    ).toEqual({ orgSlug: 'org-b', appSubdomain: 'project-c' });
  });

  it('keeps the route scope when a project is open or no fallback exists', () => {
    expect(
      getEffectiveScope(
        projectPage,
        { orgSlug: 'org-a', appSubdomain: 'project-a' },
        fallback,
      ),
    ).toEqual({ orgSlug: 'org-a', appSubdomain: 'project-a' });
    expect(
      getEffectiveScope(projectPage, { orgSlug: 'org-a' }, undefined),
    ).toEqual({ orgSlug: 'org-a' });
  });

  it('fills only the org for org pages without a route org', () => {
    expect(getEffectiveScope(orgPage, {}, fallback)).toEqual({
      orgSlug: 'org-b',
    });
    expect(getEffectiveScope(orgPage, { orgSlug: 'org-a' }, fallback)).toEqual({
      orgSlug: 'org-a',
    });
  });
});

describe('withProjectFallbackHint', () => {
  it('hints project pages with a destination and leaves everything else alone', () => {
    const tree: CommandNode = {
      id: 'root',
      title: 'Root',
      kind: 'group',
      children: [
        {
          id: 'project-pages',
          title: 'Project pages',
          kind: 'group',
          scope: 'project',
          children: [
            projectPage,
            { ...projectPage, id: 'hinted', hint: 'Keep me' },
          ],
        },
        orgPage,
      ],
    };

    const hinted = withProjectFallbackHint(
      tree,
      'Org B / Project C (project-c)',
    );
    const [pages, org] = hinted.children ?? [];

    expect(pages?.hint).toBeUndefined();
    expect(pages?.children?.[0]?.hint).toBe('Org B / Project C (project-c)');
    expect(pages?.children?.[1]?.hint).toBe('Keep me');
    expect(org?.hint).toBeUndefined();
  });
});
