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

const graphQLSettingsTabChildren = toSettingsTabNodes(
  'project-graphql',
  'graphql/settings',
  [
    {
      slug: 'engine',
      title: 'GraphQL Engine',
      keywords: [
        'graphql',
        'settings',
        'hasura',
        'version',
        'log level',
        'enabled apis',
        'pool size',
      ],
    },
    {
      slug: 'access-and-tooling',
      title: 'GraphQL Access and Tooling',
      keywords: [
        'graphql',
        'settings',
        'cors',
        'console',
        'dev mode',
        'allow list',
        'remote schema permissions',
        'infer function permissions',
      ],
    },
    {
      slug: 'custom-domain',
      title: 'GraphQL Custom Domain',
      keywords: ['graphql', 'settings', 'custom domain', 'hasura domain'],
      gate: 'platform',
    },
    {
      slug: 'rate-limiting',
      title: 'GraphQL Rate Limiting',
      keywords: [
        'graphql',
        'settings',
        'rate limiting',
        'rate limits',
        'hasura',
      ],
    },
  ],
);

const authSettingsTabChildren = toSettingsTabNodes(
  'project-auth',
  'auth/settings',
  [
    {
      slug: 'sign-in-methods',
      title: 'Auth Sign-In Methods',
      keywords: [
        'auth',
        'settings',
        'sign-in',
        'email password',
        'magic link',
        'webauthn',
        'anonymous',
        'sms',
        'otp',
        'social providers',
      ],
    },
    {
      slug: 'oauth2-provider',
      title: 'Auth OAuth2 Provider',
      keywords: ['auth', 'settings', 'oauth2 provider', 'oauth'],
    },
    {
      slug: 'smtp',
      title: 'Auth SMTP',
      keywords: ['auth', 'settings', 'smtp', 'postmark', 'email'],
    },
    {
      slug: 'authentication',
      title: 'Auth Authentication',
      keywords: [
        'auth',
        'settings',
        'client url',
        'redirect urls',
        'allowed emails',
        'blocked emails',
        'mfa',
        'session',
        'gravatar',
        'user creation',
        'conceal errors',
      ],
    },
    {
      slug: 'roles-and-permissions',
      title: 'Auth Roles and Permissions',
      keywords: [
        'auth',
        'settings',
        'roles',
        'permissions',
        'permission variables',
        'allowed roles',
      ],
    },
    {
      slug: 'jwt',
      title: 'Auth JWT',
      keywords: ['auth', 'settings', 'jwt', 'json web token', 'secrets'],
    },
    {
      slug: 'custom-domain',
      title: 'Auth Custom Domain',
      keywords: ['auth', 'settings', 'custom domain'],
      gate: 'platform',
    },
    {
      slug: 'rate-limiting',
      title: 'Auth Rate Limiting',
      keywords: [
        'auth',
        'settings',
        'rate limiting',
        'rate limits',
        'brute force',
      ],
    },
  ],
);

const storageSettingsTabChildren = toSettingsTabNodes(
  'project-storage',
  'storage/settings',
  [
    {
      slug: 'storage',
      title: 'Storage General Settings',
      keywords: ['storage', 'settings', 'version', 'antivirus'],
    },
    {
      slug: 'rate-limiting',
      title: 'Storage Rate Limiting',
      keywords: ['storage', 'settings', 'rate limiting', 'rate limits'],
    },
  ],
);

const functionsSettingsTabChildren = toSettingsTabNodes(
  'project-functions',
  'functions/settings',
  [
    {
      slug: 'custom-domain',
      title: 'Functions Custom Domain',
      keywords: ['functions', 'settings', 'custom domain'],
      gate: 'platform',
    },
    {
      slug: 'rate-limiting',
      title: 'Functions Rate Limiting',
      keywords: ['functions', 'settings', 'rate limiting', 'rate limits'],
    },
  ],
);

const runSettingsTabChildren = toSettingsTabNodes(
  'project-run',
  'run/settings',
  [
    {
      slug: 'custom-domain',
      title: 'Run Custom Domain',
      keywords: ['run', 'settings', 'custom domain'],
      gate: 'platform',
    },
    {
      slug: 'rate-limiting',
      title: 'Run Rate Limiting',
      keywords: ['run', 'settings', 'rate limiting', 'rate limits'],
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
  graphql: toSubPageNodes(
    projectSubPagesBySlug.graphql,
    'project-graphql',
    {
      playground: ['graphql', 'api', 'console'],
      'remote-schemas': ['graphql', 'remote', 'schemas'],
      actions: ['graphql', 'mutations', 'webhooks', 'custom types'],
      metadata: ['graphql', 'metadata'],
      console: ['graphql', 'hasura', 'console', 'graphql engine'],
      settings: ['graphql', 'settings'],
    },
    { settings: graphQLSettingsTabChildren },
  ),
  events: toSubPageNodes(projectSubPagesBySlug.events, 'project-events', {
    'event-triggers': ['events', 'webhooks'],
    'cron-triggers': ['events', 'scheduled'],
    'one-offs': ['events', 'scheduled'],
  }),
  auth: toSubPageNodes(
    projectSubPagesBySlug.auth,
    'project-auth',
    {
      users: ['auth', 'accounts'],
      'oauth2-clients': ['auth', 'oauth', 'clients'],
      settings: ['auth', 'settings'],
    },
    { settings: authSettingsTabChildren },
  ),
  storage: toSubPageNodes(
    projectSubPagesBySlug.storage,
    'project-storage',
    {
      storage: ['storage', 'files', 'buckets'],
      settings: ['storage', 'settings'],
    },
    { settings: storageSettingsTabChildren },
  ),
  functions: toSubPageNodes(
    projectSubPagesBySlug.functions,
    'project-functions',
    {
      functions: ['functions', 'serverless', 'code'],
      settings: ['functions', 'settings'],
    },
    { settings: functionsSettingsTabChildren },
  ),
  run: toSubPageNodes(
    projectSubPagesBySlug.run,
    'project-run',
    {
      services: ['run', 'services', 'containers'],
      settings: ['run', 'settings'],
    },
    { settings: runSettingsTabChildren },
  ),
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
  deployments: { keywords: ['settings', 'releases'] },
  ai: { keywords: ['settings', 'embeddings'] },
  metrics: {
    id: 'project-settings-observability',
    keywords: ['settings', 'metrics', 'monitoring'],
  },
};

// The project settings page's own `?tab=` entries.
const generalSettingsTabChildren = toSettingsTabNodes('project', 'settings', [
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
]);

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
  auth: {
    keywords: ['users', 'authentication'],
    children: subPageChildren.auth,
  },
  storage: {
    keywords: ['files', 'buckets'],
    children: subPageChildren.storage,
  },
  functions: {
    keywords: ['serverless', 'code'],
    children: subPageChildren.functions,
  },
  run: {
    keywords: ['services', 'docker'],
    children: subPageChildren.run,
  },
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
