import {
  CogIcon,
  CreditCardIcon,
  FileTextIcon,
  HomeIcon,
  Building2 as OrgIcon,
  UsersIcon,
} from 'lucide-react';
import type { ReactElement } from 'react';
import {
  getSettingsPageRoute,
  orgPages,
  projectAIPages,
  projectAuthPages,
  projectDatabasePages,
  projectEventsPages,
  projectGraphQLPages,
  projectPages,
  projectSettingsPages,
} from '@/components/layout/MainNav/nav-config';
import type { CommandNode } from '@/features/command-palette/types';

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

// Palette-only metadata layered over the nav-config catalog, keyed by slug.
interface PaletteMeta {
  id?: string;
  title?: string;
  keywords?: string[];
  icon?: ReactElement;
  children?: CommandNode[];
}

const toSubPageNodes = <Slug extends string>(
  pages: ReadonlyArray<{ name: string; slug: Slug; route: string }>,
  idPrefix: string,
  keywordsBySlug: Record<Slug, string[]>,
): CommandNode[] =>
  pages.map((page) => ({
    id: `${idPrefix}-${page.slug}`,
    title: page.name,
    kind: 'page',
    path: page.route,
    scope: 'project',
    keywords: keywordsBySlug[page.slug],
  }));

const databaseChildren = toSubPageNodes(
  projectDatabasePages,
  'project-database',
  {
    browser: ['database', 'tables', 'rows'],
    schema: ['database', 'schema', 'columns'],
  },
);

const graphqlChildren = toSubPageNodes(projectGraphQLPages, 'project-graphql', {
  playground: ['graphql', 'api', 'console'],
  'remote-schemas': ['graphql', 'remote', 'schemas'],
  metadata: ['graphql', 'metadata'],
});

const eventsChildren = toSubPageNodes(projectEventsPages, 'project-events', {
  'event-triggers': ['events', 'webhooks'],
  'cron-triggers': ['events', 'scheduled'],
  'one-offs': ['events', 'scheduled'],
});

const authChildren = toSubPageNodes(projectAuthPages, 'project-auth', {
  users: ['auth', 'accounts'],
  'oauth2-clients': ['auth', 'oauth', 'clients'],
});

const aiChildren = toSubPageNodes(projectAIPages, 'project-ai', {
  'auto-embeddings': ['ai', 'embeddings'],
  assistants: ['ai', 'agents'],
  'file-stores': ['ai', 'files', 'vector'],
});

const settingsPageMeta: Record<
  (typeof projectSettingsPages)[number]['slug'],
  PaletteMeta
> = {
  general: { keywords: ['settings'] },
  'compute-resources': { keywords: ['settings', 'cpu', 'memory'] },
  database: { keywords: ['settings', 'postgres'] },
  hasura: { keywords: ['settings', 'graphql engine', 'console'] },
  authentication: { keywords: ['settings', 'auth'] },
  jwt: { keywords: ['settings', 'tokens'] },
  'sign-in-methods': { keywords: ['settings', 'login'] },
  'oauth2-provider': { keywords: ['settings', 'oauth'] },
  'roles-and-permissions': { keywords: ['settings', 'access control'] },
  storage: { keywords: ['settings', 'files'] },
  smtp: { keywords: ['settings', 'email'] },
  deployments: { keywords: ['settings', 'releases'] },
  'environment-variables': { keywords: ['settings', 'env'] },
  secrets: { keywords: ['settings', 'environment'] },
  'custom-domains': { keywords: ['settings', 'domains'] },
  'rate-limiting': { keywords: ['settings', 'limits'] },
  ai: { keywords: ['settings', 'embeddings'] },
  metrics: {
    id: 'project-settings-observability',
    keywords: ['settings', 'metrics', 'monitoring'],
  },
  editor: {
    id: 'project-settings-configuration-editor',
    keywords: ['settings', 'config'],
  },
};

const settingsChildren: CommandNode[] = projectSettingsPages.map((page) => {
  const meta = settingsPageMeta[page.slug];

  return {
    id: meta.id ?? `project-settings-${page.slug}`,
    title: meta.title ?? page.name,
    kind: 'setting',
    path: getSettingsPageRoute(page),
    scope: 'project',
    keywords: meta.keywords,
  };
});

const projectPageMeta: Record<
  (typeof projectPages)[number]['slug'],
  PaletteMeta
> = {
  overview: { keywords: ['home', 'summary'] },
  database: {
    keywords: ['tables', 'schema', 'sql'],
    children: databaseChildren,
  },
  graphql: {
    keywords: ['api', 'playground', 'queries'],
    children: graphqlChildren,
  },
  events: {
    keywords: ['triggers', 'cron', 'scheduled'],
    children: eventsChildren,
  },
  hasura: { keywords: ['console', 'graphql engine'] },
  auth: { keywords: ['users', 'authentication'], children: authChildren },
  storage: { keywords: ['files', 'buckets'] },
  functions: { keywords: ['serverless', 'code'] },
  run: { keywords: ['services', 'docker'] },
  ai: {
    keywords: ['auto embeddings', 'embeddings'],
    children: aiChildren,
  },
  deployments: { keywords: ['releases'] },
  backups: { keywords: ['restore', 'snapshots'] },
  logs: { keywords: ['log entries'] },
  metrics: { keywords: ['observability', 'monitoring'] },
  settings: {
    title: 'Project Settings',
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
    title: 'Organization Settings',
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

export const commandPaletteNavTree = withInheritedIcons(rawNavTree);
