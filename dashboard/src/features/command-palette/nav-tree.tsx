import {
  CircleHelpIcon,
  CircleUserIcon,
  CogIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  Building2 as OrgIcon,
  UsersIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { CommandNode } from '@/features/command-palette/types';
import {
  getSettingsPageRoute,
  orgPages,
  projectPages,
  projectSettingsPages,
  projectSubPagesBySlug,
} from '@/features/navigation/nav-config';

const iconClassName = 'h-4 w-4';

const withInheritedIcons = (
  node: CommandNode,
  inheritedIcon?: CommandNode['icon'],
): CommandNode => {
  const icon = node.icon ?? inheritedIcon;

  return {
    ...node,
    icon,
    children: node.children?.map((child) => withInheritedIcons(child, icon)),
  };
};

// Only nodes with a path are navigable breadcrumb levels; structural groups
// like 'project-pages' don't contribute to the trail.
const withBreadcrumbs = (
  node: CommandNode,
  trail: string[] = [],
): CommandNode => {
  const childTrail = node.path !== undefined ? [...trail, node.title] : trail;

  return {
    ...node,
    breadcrumb: trail.length > 0 ? trail : undefined,
    children: node.children?.map((child) => withBreadcrumbs(child, childTrail)),
  };
};

// Palette-only metadata layered over the nav-config catalog, keyed by slug.
interface PaletteMeta {
  id?: string;
  title?: string;
  keywords?: string[];
  icon?: ReactElement;
  children?: CommandNode[];
}

const toSubPageNodes = <Slug extends string>(
  pages: ReadonlyArray<{
    name: string;
    slug: Slug;
    route: string;
    gate?: CommandNode['gate'];
  }>,
  idPrefix: string,
  keywordsBySlug: Record<Slug, string[]>,
  childrenBySlug: Partial<Record<Slug, CommandNode[]>> = {},
): CommandNode[] =>
  pages.map((page) => ({
    id: `${idPrefix}-${page.slug}`,
    title: page.name,
    kind: 'page',
    path: page.route,
    scope: 'project',
    keywords: keywordsBySlug[page.slug],
    gate: page.gate,
    children: childrenBySlug[page.slug],
  }));

interface SettingsTabEntry {
  slug: string;
  title: string;
  keywords: string[];
  gate?: CommandNode['gate'];
}

// A settings page's `?tab=` entries, so the palette can land on the tab
// directly instead of on the page.
const toSettingsTabNodes = (
  idPrefix: string,
  settingsRoute: string,
  tabs: ReadonlyArray<SettingsTabEntry>,
): CommandNode[] =>
  tabs.map((tab) => ({
    id: `${idPrefix}-settings-${tab.slug}`,
    title: tab.title,
    kind: 'setting',
    path: `${settingsRoute}?tab=${tab.slug}`,
    scope: 'project',
    keywords: tab.keywords,
    gate: tab.gate,
  }));

const databaseSettingsTabChildren = toSettingsTabNodes(
  'project-database',
  'database/settings',
  [
    {
      slug: 'version',
      title: 'Database Postgres Version',
      keywords: ['database', 'settings', 'postgres', 'version'],
    },
    {
      slug: 'capacity',
      title: 'Database Storage Capacity',
      keywords: ['database', 'settings', 'storage capacity', 'database size'],
    },
    {
      slug: 'point-in-time',
      title: 'Database Point-in-Time Recovery',
      keywords: ['database', 'settings', 'pitr', 'backups', 'point in time'],
      gate: 'platform',
    },
    {
      slug: 'access',
      title: 'Database Access',
      keywords: [
        'database',
        'settings',
        'access',
        'connection string',
        'allowed cidrs',
        'cidr',
      ],
      gate: 'platform',
    },
    {
      slug: 'custom-domain',
      title: 'Database Custom Domain',
      keywords: ['database', 'settings', 'custom domain'],
      gate: 'platform',
    },
    {
      slug: 'reset-password',
      title: 'Database Reset Password',
      keywords: ['database', 'settings', 'password', 'reset password'],
      gate: 'platform',
    },
  ],
);

// Exhaustive over nav-config's sub-page families, so adding a family there
// fails to compile until the palette assigns its keywords.
const subPageChildren: Record<
  keyof typeof projectSubPagesBySlug,
  CommandNode[]
> = {
  database: toSubPageNodes(
    projectSubPagesBySlug.database,
    'project-database',
    {
      browser: ['database', 'tables', 'rows'],
      schema: ['database', 'schema', 'columns'],
      'sql-console': ['database', 'sql', 'console'],
      backups: ['database', 'restore', 'snapshots'],
      settings: ['database', 'settings'],
    },
    { settings: databaseSettingsTabChildren },
  ),
  graphql: toSubPageNodes(projectSubPagesBySlug.graphql, 'project-graphql', {
    playground: ['graphql', 'api', 'console'],
    'remote-schemas': ['graphql', 'remote', 'schemas'],
    actions: ['graphql', 'mutations', 'webhooks', 'custom types'],
    metadata: ['graphql', 'metadata'],
  }),
  events: toSubPageNodes(projectSubPagesBySlug.events, 'project-events', {
    'event-triggers': ['events', 'webhooks'],
    'cron-triggers': ['events', 'scheduled'],
    'one-offs': ['events', 'scheduled'],
  }),
  auth: toSubPageNodes(projectSubPagesBySlug.auth, 'project-auth', {
    users: ['auth', 'accounts'],
    'oauth2-clients': ['auth', 'oauth', 'clients'],
  }),
  ai: toSubPageNodes(projectSubPagesBySlug.ai, 'project-ai', {
    'auto-embeddings': ['ai', 'embeddings'],
    assistants: ['ai', 'agents'],
    'file-stores': ['ai', 'files', 'vector'],
  }),
};

const settingsPageMeta: Record<
  (typeof projectSettingsPages)[number]['slug'],
  PaletteMeta
> = {
  general: {
    title: 'Project Settings',
    keywords: [
      'settings',
      'project name',
      'pause project',
      'wake project',
      'transfer project',
      'delete project',
    ],
  },
  hasura: { keywords: ['settings', 'graphql engine', 'console'] },
  authentication: { keywords: ['settings', 'auth'] },
  jwt: { keywords: ['settings', 'tokens'] },
  'sign-in-methods': { keywords: ['settings', 'login'] },
  'oauth2-provider': { keywords: ['settings', 'oauth'] },
  'roles-and-permissions': { keywords: ['settings', 'access control'] },
  storage: { keywords: ['settings', 'files'] },
  smtp: { keywords: ['settings', 'email'] },
  deployments: { keywords: ['settings', 'releases'] },
  'custom-domains': { keywords: ['settings', 'domains'] },
  'rate-limiting': { keywords: ['settings', 'limits'] },
  ai: { keywords: ['settings', 'embeddings'] },
  metrics: {
    id: 'project-settings-observability',
    keywords: ['settings', 'metrics', 'monitoring'],
  },
};

// The project settings page's own `?tab=` entries.
const generalSettingsTabChildren = toSettingsTabNodes(
  'project',
  'settings',
  [
    {
      slug: 'compute-resources',
      title: 'Compute Resources',
      keywords: ['settings', 'compute resources', 'cpu', 'memory'],
    },
    {
      slug: 'environment-variables',
      title: 'Environment Variables',
      keywords: [
        'settings',
        'environment variables',
        'system environment variables',
        'env vars',
      ],
    },
    {
      slug: 'secrets',
      title: 'Secrets',
      keywords: ['settings', 'secrets'],
    },
    {
      slug: 'editor',
      title: 'Configuration Editor',
      keywords: ['settings', 'configuration editor', 'toml'],
    },
  ],
);

const settingsChildren: CommandNode[] = [
  ...projectSettingsPages.map((page) => {
    const meta = settingsPageMeta[page.slug];

    return {
      id: meta.id ?? `project-settings-${page.slug}`,
      title: meta.title ?? page.name,
      kind: 'setting' as const,
      path: getSettingsPageRoute(page),
      scope: 'project' as const,
      keywords: meta.keywords,
    };
  }),
  ...generalSettingsTabChildren,
];

const projectPageMeta: Record<
  (typeof projectPages)[number]['slug'],
  PaletteMeta
> = {
  overview: { keywords: ['home', 'summary'] },
  database: {
    keywords: ['tables', 'schema', 'sql'],
    children: subPageChildren.database,
  },
  graphql: {
    keywords: ['api', 'playground', 'queries'],
    children: subPageChildren.graphql,
  },
  events: {
    keywords: ['triggers', 'cron', 'scheduled'],
    children: subPageChildren.events,
  },
  hasura: { keywords: ['console', 'graphql engine'] },
  auth: {
    keywords: ['users', 'authentication'],
    children: subPageChildren.auth,
  },
  storage: { keywords: ['files', 'buckets'] },
  functions: { keywords: ['serverless', 'code'] },
  run: { keywords: ['services', 'docker'] },
  ai: {
    keywords: ['auto embeddings', 'embeddings'],
    children: subPageChildren.ai,
  },
  deployments: { keywords: ['releases'] },
  logs: { keywords: ['log entries'] },
  metrics: { keywords: ['observability', 'monitoring'] },
  settings: {
    title: 'Settings (Project)',
    keywords: ['configuration'],
    icon: <CogIcon className={iconClassName} />,
    children: settingsChildren,
  },
};

const projectPageNodes: CommandNode[] = projectPages.map((page) => {
  const meta = projectPageMeta[page.slug];

  return {
    id: `project-${page.slug}`,
    title: meta.title ?? page.name,
    icon: meta.icon ?? page.icon,
    kind: meta.children ? 'group' : 'page',
    path: page.route,
    scope: 'project',
    keywords: meta.keywords,
    gate: page.gate,
    children: meta.children,
  };
});

const orgPageMeta: Record<(typeof orgPages)[number]['slug'], PaletteMeta> = {
  projects: { icon: <HomeIcon className={iconClassName} /> },
  settings: {
    title: 'Settings (Organization)',
    icon: <CogIcon className={iconClassName} />,
  },
  members: {
    icon: <UsersIcon className={iconClassName} />,
    keywords: ['team', 'users'],
  },
  billing: {
    icon: <CreditCardIcon className={iconClassName} />,
    keywords: ['plan', 'payment'],
  },
};

const orgPageNodes: CommandNode[] = orgPages.map((page) => {
  const meta = orgPageMeta[page.slug];

  return {
    id: `org-${page.slug}`,
    title: meta.title ?? page.name,
    icon: meta.icon,
    kind: 'org',
    path: page.route,
    scope: 'org',
    keywords: meta.keywords,
    gate: page.gate,
  };
});

const rawNavTree: CommandNode = {
  id: 'root',
  title: 'Command palette',
  kind: 'group',
  children: [
    {
      id: 'project-pages',
      title: 'Project pages',
      kind: 'group',
      scope: 'project',
      children: projectPageNodes,
    },
    {
      id: 'org-pages',
      title: 'Organization pages',
      icon: <OrgIcon className={iconClassName} />,
      kind: 'group',
      scope: 'org',
      children: orgPageNodes,
    },
    {
      id: 'account-settings',
      title: 'Account Settings',
      icon: <CircleUserIcon className={iconClassName} />,
      kind: 'page',
      path: '/account',
      keywords: ['account', 'profile', 'settings'],
      gate: 'platform',
    },
    {
      id: 'support',
      title: 'Support',
      icon: <CircleHelpIcon className={iconClassName} />,
      kind: 'page',
      path: '/support',
      scope: 'external',
      keywords: ['support', 'help', 'contact'],
      gate: 'platform',
    },
    {
      id: 'docs',
      title: 'Docs',
      icon: <FileTextIcon className={iconClassName} />,
      kind: 'doc',
      path: 'https://docs.nhost.io',
      scope: 'external',
      keywords: ['documentation', 'guides', 'reference'],
    },
  ],
};

export const commandPaletteNavTree = withBreadcrumbs(
  withInheritedIcons(rawNavTree),
);
