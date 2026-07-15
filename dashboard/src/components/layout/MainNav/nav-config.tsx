import {
  SiGraphql as GraphQLIcon,
  SiHasura as HasuraIcon,
  SiDocker as ServicesIcon,
} from '@icons-pack/react-simple-icons';
import {
  Sparkles as AIIcon,
  Box,
  CloudIcon,
  Code,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  Plus,
  RocketIcon,
  HardDrive as StorageIcon,
  UserIcon,
  Zap,
} from 'lucide-react';
import type { ReactElement } from 'react';
import type { TreeItem, TreeItemIndex } from 'react-complex-tree';
import type { Org } from '@/features/orgs/projects/hooks/useOrgs';
import { isSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { isPlatform as getIsPlatform } from '@/utils/env';

// 'platform' pages need the hosted platform; 'settings' pages also work
// self-hosted when a config server is set.
export type PageGate = 'platform' | 'settings';

interface PageEntry<Slug extends string = string> {
  name: string;
  slug: Slug;
  route: string;
  icon?: ReactElement;
  gate?: PageGate;
}

const definePages = <Slugs extends string>(
  pages: ReadonlyArray<PageEntry<Slugs>>,
): ReadonlyArray<PageEntry<Slugs>> => pages;

export const projectPages = definePages([
  {
    name: 'Overview',
    icon: <HomeIcon className="h-4 w-4" />,
    route: '',
    slug: 'overview',
  },
  {
    name: 'Database',
    icon: <DatabaseIcon className="h-4 w-4" />,
    route: 'database/browser/default',
    slug: 'database',
  },
  {
    name: 'GraphQL',
    icon: <GraphQLIcon className="h-4 w-4" />,
    route: 'graphql',
    slug: 'graphql',
  },
  {
    name: 'Events',
    icon: <Zap className="h-4 w-4" />,
    route: 'events/event-triggers',
    slug: 'events',
  },
  {
    name: 'Hasura',
    icon: <HasuraIcon className="h-4 w-4" />,
    route: 'hasura',
    slug: 'hasura',
  },
  {
    name: 'Auth',
    icon: <UserIcon className="h-4 w-4" />,
    route: 'auth/users',
    slug: 'auth',
  },
  {
    name: 'Storage',
    icon: <StorageIcon className="h-4 w-4" />,
    route: 'storage',
    slug: 'storage',
  },
  {
    name: 'Functions',
    icon: <Code className="h-4 w-4" />,
    route: 'functions',
    slug: 'functions',
  },
  {
    name: 'Run',
    icon: <ServicesIcon className="h-4 w-4" />,
    route: 'run',
    slug: 'run',
  },
  {
    name: 'AI',
    icon: <AIIcon className="h-4 w-4" />,
    route: 'ai/auto-embeddings',
    slug: 'ai',
    gate: 'settings',
  },
  {
    name: 'Deployments',
    icon: <RocketIcon className="h-4 w-4" />,
    route: 'deployments',
    slug: 'deployments',
    gate: 'platform',
  },
  {
    name: 'Backups',
    icon: <CloudIcon className="h-4 w-4" />,
    route: 'backups',
    slug: 'backups',
    gate: 'platform',
  },
  {
    name: 'Logs',
    icon: <FileTextIcon className="h-4 w-4" />,
    route: 'logs',
    slug: 'logs',
  },
  {
    name: 'Metrics',
    icon: <GaugeIcon className="h-4 w-4" />,
    route: 'metrics',
    slug: 'metrics',
    gate: 'platform',
  },
  {
    name: 'Settings',
    route: 'settings',
    slug: 'settings',
    gate: 'settings',
  },
]);

export const projectSettingsPages = definePages([
  { name: 'General', slug: 'general', route: '' },
  {
    name: 'Compute Resources',
    slug: 'compute-resources',
    route: 'compute-resources',
  },
  { name: 'Database', slug: 'database', route: 'database' },
  { name: 'Hasura', slug: 'hasura', route: 'hasura' },
  {
    name: 'Authentication',
    slug: 'authentication',
    route: 'authentication',
  },
  {
    name: 'JWT',
    slug: 'jwt',
    route: 'jwt',
  },
  {
    name: 'Sign-In methods',
    slug: 'sign-in-methods',
    route: 'sign-in-methods',
  },
  {
    name: 'OAuth2 Provider',
    slug: 'oauth2-provider',
    route: 'oauth2-provider',
  },
  {
    name: 'Roles and Permissions',
    slug: 'roles-and-permissions',
    route: 'roles-and-permissions',
  },
  { name: 'Storage', slug: 'storage', route: 'storage' },
  { name: 'SMTP', slug: 'smtp', route: 'smtp' },
  { name: 'Deployments', slug: 'deployments', route: 'deployments' },
  {
    name: 'Environment Variables',
    slug: 'environment-variables',
    route: 'environment-variables',
  },
  { name: 'Secrets', slug: 'secrets', route: 'secrets' },
  {
    name: 'Custom Domains',
    slug: 'custom-domains',
    route: 'custom-domains',
  },
  {
    name: 'Rate Limiting',
    slug: 'rate-limiting',
    route: 'rate-limiting',
  },
  { name: 'AI', slug: 'ai', route: 'ai' },
  { name: 'Observability', slug: 'metrics', route: 'metrics' },
  { name: 'Configuration Editor', slug: 'editor', route: 'editor' },
]);

export const projectGraphQLPages = definePages([
  {
    name: 'Playground',
    slug: 'playground',
    route: 'graphql',
  },
  {
    name: 'Remote Schemas',
    slug: 'remote-schemas',
    route: 'graphql/remote-schemas',
  },
  {
    name: 'Metadata',
    slug: 'metadata',
    route: 'graphql/metadata',
  },
]);

export const projectEventsPages = definePages([
  {
    name: 'Event Triggers',
    slug: 'event-triggers',
    route: 'events/event-triggers',
  },
  {
    name: 'Cron Triggers',
    slug: 'cron-triggers',
    route: 'events/cron-triggers',
  },
  {
    name: 'One-Off Scheduled Events',
    slug: 'one-offs',
    route: 'events/one-offs',
  },
]);

export const projectAuthPages = definePages([
  {
    name: 'Users',
    slug: 'users',
    route: 'auth/users',
  },
  {
    name: 'OAuth2 Clients',
    slug: 'oauth2-clients',
    route: 'auth/oauth2-clients',
  },
]);

export const projectDatabasePages = definePages([
  {
    name: 'Table Editor & Browser',
    slug: 'browser',
    route: 'database/browser/default',
  },
  {
    name: 'Schema Navigator',
    slug: 'schema',
    route: 'database/schema/default',
  },
]);

export const projectAIPages = definePages([
  {
    name: 'Auto-embeddings',
    slug: 'auto-embeddings',
    route: 'ai/auto-embeddings',
  },
  { name: 'Assistants', slug: 'assistants', route: 'ai/assistants' },
  { name: 'File stores', slug: 'file-stores', route: 'ai/file-stores' },
]);

export const orgPages = definePages([
  { name: 'Projects', slug: 'projects', route: 'projects' },
  { name: 'Settings', slug: 'settings', route: 'settings', gate: 'platform' },
  { name: 'Members', slug: 'members', route: 'members', gate: 'platform' },
  { name: 'Billing', slug: 'billing', route: 'billing', gate: 'platform' },
]);

export type NavGating = {
  isNotPlatform: boolean;
  shouldDisableSettings: boolean;
};

export const isPageGated = (
  gate: PageGate | undefined,
  gating: NavGating,
): boolean =>
  (gate === 'platform' && gating.isNotPlatform) ||
  (gate === 'settings' && gating.shouldDisableSettings);

export type NavItem = {
  name: string;
  slug?: string;
  type?: string;
  isFree?: boolean;
  plan?: string;
  icon?: ReactElement;
  targetUrl?: string;
  disabled?: boolean;
  isProjectPage?: boolean;
};

type NavTreeItems = Record<TreeItemIndex, TreeItem<NavItem>>;

type ProjectPage = (typeof projectPages)[number];
type SettingsPage = (typeof projectSettingsPages)[number];

const getNavGating = (): NavGating => ({
  isNotPlatform: !getIsPlatform(),
  shouldDisableSettings: isSettingsDisabled(),
});

export const getOrgUrl = (orgSlug: string) => `/orgs/${orgSlug}`;

export const getProjectUrl = (orgSlug: string, appSubdomain: string) =>
  `${getOrgUrl(orgSlug)}/projects/${appSubdomain}`;

const getOrgProjectsUrl = (org: Org) => `${getOrgUrl(org.slug)}/projects`;

const getNewProjectUrl = (org: Org) => `${getOrgProjectsUrl(org)}/new`;

const getProjectBaseUrl = (org: Org, app: Org['apps'][number]) =>
  getProjectUrl(org.slug, app.subdomain);

const getProjectPageUrl = (
  org: Org,
  app: Org['apps'][number],
  page: { route: string },
) => `${getProjectBaseUrl(org, app)}/${page.route}`;

export const getSettingsPageRoute = (page: { route: string }) =>
  page.route ? `settings/${page.route}` : 'settings';

const getProjectSettingsPageUrl = (
  org: Org,
  app: Org['apps'][number],
  page: SettingsPage,
) => `${getProjectBaseUrl(org, app)}/${getSettingsPageRoute(page)}`;

export const projectSubPagesBySlug = {
  database: projectDatabasePages,
  graphql: projectGraphQLPages,
  events: projectEventsPages,
  auth: projectAuthPages,
  ai: projectAIPages,
} satisfies Partial<Record<ProjectPage['slug'], ReadonlyArray<PageEntry>>>;

// Widened view so lookups can be keyed by any project-page slug.
const subPagesBySlug: Partial<
  Record<ProjectPage['slug'], ReadonlyArray<PageEntry>>
> = projectSubPagesBySlug;

const getProjectPageChildren = (
  org: Org,
  app: Org['apps'][number],
  page: ProjectPage,
  gating: NavGating,
) => {
  if (isPageGated(page.gate, gating)) {
    return undefined;
  }

  if (page.slug === 'settings') {
    return projectSettingsPages.map(
      (p) => `${org.slug}-${app.subdomain}-settings-${p.slug}`,
    );
  }

  return subPagesBySlug[page.slug]?.map(
    (p) => `${org.slug}-${app.subdomain}-${page.slug}-${p.slug}`,
  );
};

const createOrganization = (org: Org): NavTreeItems => {
  const gating = getNavGating();
  const result: NavTreeItems = {};

  result[org.slug] = {
    index: org.slug,
    canMove: false,
    isFolder: true,
    children: orgPages.map((page) => `${org.slug}-${page.slug}`),
    data: {
      name: org.name,
      slug: org.slug,
      type: 'org',
      isFree: org.plan.isFree,
      plan: org.plan.name,
      targetUrl: getOrgProjectsUrl(org),
      disabled: false,
    },
    canRename: false,
  };

  result[`${org.slug}-projects`] = {
    index: `${org.slug}-projects`,
    canMove: false,
    isFolder: true,
    children: [
      ...org.apps.map((app) => `${org.slug}-${app.subdomain}`),
      `${org.slug}-new-project`,
    ],
    data: {
      name: 'Projects',
      targetUrl: getOrgProjectsUrl(org),
      disabled: false,
    },
    canRename: false,
  };

  result[`${org.slug}-new-project`] = {
    index: `${org.slug}-new-project`,
    isFolder: false,
    canMove: false,
    canRename: false,
    data: {
      name: 'New project',
      slug: 'new',
      icon: <Plus className="mr-1 h-4 w-4 font-bold" strokeWidth={3} />,
      targetUrl: getNewProjectUrl(org),
      disabled: gating.isNotPlatform,
    },
  };

  org.apps.forEach((app) => {
    result[`${org.slug}-${app.subdomain}`] = {
      index: `${org.slug}-${app.subdomain}`,
      isFolder: true,
      canMove: false,
      canRename: false,
      data: {
        name: app.name,
        slug: app.subdomain,
        icon: <Box className="h-4 w-4" />,
        targetUrl: getProjectBaseUrl(org, app),
      },
      children: projectPages.map(
        (page) => `${org.slug}-${app.subdomain}-${page.slug}`,
      ),
    };
  });

  org.apps.forEach((app) => {
    projectPages.forEach((page) => {
      const children = getProjectPageChildren(org, app, page, gating);

      result[`${org.slug}-${app.subdomain}-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-${page.slug}`,
        canMove: false,
        isFolder: children !== undefined,
        children,
        data: {
          name: page.name,
          icon: page.icon,
          isProjectPage: true,
          targetUrl: getProjectPageUrl(org, app, page),
          disabled: isPageGated(page.gate, gating),
        },
        canRename: false,
      };
    });

    projectSettingsPages.forEach((page) => {
      result[`${org.slug}-${app.subdomain}-settings-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-settings-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: page.name,
          targetUrl: getProjectSettingsPageUrl(org, app, page),
          disabled: gating.shouldDisableSettings,
        },
        canRename: false,
      };
    });

    Object.entries(subPagesBySlug).forEach(([slug, pages]) => {
      pages?.forEach((page) => {
        result[`${org.slug}-${app.subdomain}-${slug}-${page.slug}`] = {
          index: `${org.slug}-${app.subdomain}-${slug}-${page.slug}`,
          canMove: false,
          isFolder: false,
          children: undefined,
          data: {
            name: page.name,
            targetUrl: getProjectPageUrl(org, app, page),
          },
          canRename: false,
        };
      });
    });
  });

  orgPages
    .filter((page) => page.slug !== 'projects')
    .forEach((page) => {
      result[`${org.slug}-${page.slug}`] = {
        index: `${org.slug}-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: [],
        data: {
          name: page.name,
          targetUrl: `${getOrgUrl(org.slug)}/${page.route}`,
          disabled: isPageGated(page.gate, gating),
        },
        canRename: false,
      };
    });

  return result;
};

export const buildNavTreeData = (
  org?: Org,
): { items: Record<TreeItemIndex, TreeItem<NavItem>> } => {
  if (!org) {
    return {
      items: {
        root: {
          index: 'root',
          canMove: false,
          isFolder: true,
          children: [],
          data: { name: 'root' },
          canRename: false,
        },
      },
    };
  }

  const navTree = {
    items: {
      root: {
        index: 'root',
        canMove: false,
        isFolder: true,
        children: orgPages.map((page) => `${org.slug}-${page.slug}`),
        data: { name: 'root' },
        canRename: false,
      },
      ...createOrganization(org),
    },
  };

  return navTree;
};
