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
import { getConfigServerUrl, isPlatform as getIsPlatform } from '@/utils/env';

export const projectPages = [
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
  },
  {
    name: 'Deployments',
    icon: <RocketIcon className="h-4 w-4" />,
    route: 'deployments',
    slug: 'deployments',
  },
  {
    name: 'Backups',
    icon: <CloudIcon className="h-4 w-4" />,
    route: 'backups',
    slug: 'backups',
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
  },
  {
    name: 'Settings',
    route: 'settings',
    slug: 'settings',
  },
];

export const projectSettingsPages = [
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
];

export const projectGraphQLPages = [
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
];

export const projectEventsPages = [
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
];

export const projectAuthPages = [
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
];

export const projectDatabasePages = [
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
];

export type NavGating = {
  isNotPlatform: boolean;
  shouldDisableSettings: boolean;
  shouldDisableGraphite: boolean;
};

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

export type ProjectPage = (typeof projectPages)[number];
type SettingsPage = (typeof projectSettingsPages)[number];
type ProjectSubPage =
  | (typeof projectGraphQLPages)[number]
  | (typeof projectEventsPages)[number]
  | (typeof projectAuthPages)[number]
  | (typeof projectDatabasePages)[number];

export const getNavGating = (): NavGating => {
  const isNotPlatform = !getIsPlatform();
  const configServerVariableNotSet = getConfigServerUrl() === '';
  const shouldDisableSettings = isNotPlatform && configServerVariableNotSet;
  const shouldDisableGraphite = shouldDisableSettings;

  return { isNotPlatform, shouldDisableSettings, shouldDisableGraphite };
};

export const getOrgProjectsUrl = (org: Org) => `/orgs/${org.slug}/projects`;

export const getOrgSettingsUrl = (org: Org) => `/orgs/${org.slug}/settings`;

export const getOrgMembersUrl = (org: Org) => `/orgs/${org.slug}/members`;

export const getOrgBillingUrl = (org: Org) => `/orgs/${org.slug}/billing`;

export const getNewProjectUrl = (org: Org) => `${getOrgProjectsUrl(org)}/new`;

export const getProjectBaseUrl = (org: Org, app: Org['apps'][number]) =>
  `${getOrgProjectsUrl(org)}/${app.subdomain}`;

export const getProjectPageUrl = (
  org: Org,
  app: Org['apps'][number],
  page: ProjectPage,
) => `${getProjectBaseUrl(org, app)}/${page.route}`;

export const getProjectSettingsPageUrl = (
  org: Org,
  app: Org['apps'][number],
  page: SettingsPage,
) =>
  page.slug === 'general'
    ? `${getProjectBaseUrl(org, app)}/settings`
    : `${getProjectBaseUrl(org, app)}/settings/${page.route}`;

export const getProjectSubPageUrl = (
  org: Org,
  app: Org['apps'][number],
  page: ProjectSubPage,
) => `${getProjectBaseUrl(org, app)}/${page.route}`;

export const projectFolderPageSlugs = new Set([
  'database',
  'graphql',
  'events',
  'auth',
  'settings',
]);

export const isProjectPageFolder = (page: ProjectPage, gating: NavGating) =>
  projectFolderPageSlugs.has(page.slug) &&
  (page.slug !== 'settings' || !gating.shouldDisableSettings);

export const isProjectPageHiddenFromPalette = (
  page: ProjectPage,
  gating: NavGating,
) => page.slug === 'ai' && gating.isNotPlatform;

export const isProjectPageDisabled = (page: ProjectPage, gating: NavGating) =>
  (['deployments', 'backups', 'metrics'].includes(page.slug) &&
    gating.isNotPlatform) ||
  (page.name === 'Settings' && gating.shouldDisableSettings) ||
  (page.name === 'AI' && gating.shouldDisableGraphite);

const getProjectPageChildren = (
  org: Org,
  app: Org['apps'][number],
  page: ProjectPage,
  gating: NavGating,
) => {
  if (page.name === 'Settings' && !gating.shouldDisableSettings) {
    return projectSettingsPages.map(
      (p) => `${org.slug}-${app.subdomain}-settings-${p.slug}`,
    );
  }
  if (page.name === 'GraphQL') {
    return projectGraphQLPages.map(
      (p) => `${org.slug}-${app.subdomain}-graphql-${p.slug}`,
    );
  }
  if (page.name === 'Events') {
    return projectEventsPages.map(
      (p) => `${org.slug}-${app.subdomain}-events-${p.slug}`,
    );
  }
  if (page.name === 'Auth') {
    return projectAuthPages.map(
      (p) => `${org.slug}-${app.subdomain}-auth-${p.slug}`,
    );
  }
  if (page.name === 'Database') {
    return projectDatabasePages.map(
      (p) => `${org.slug}-${app.subdomain}-database-${p.slug}`,
    );
  }
  return undefined;
};

export const createOrganization = (org: Org): NavTreeItems => {
  const gating = getNavGating();
  const result: NavTreeItems = {};

  result[org.slug] = {
    index: org.slug,
    canMove: false,
    isFolder: true,
    children: [
      `${org.slug}-projects`,
      `${org.slug}-settings`,
      `${org.slug}-members`,
      `${org.slug}-billing`,
    ],
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
      result[`${org.slug}-${app.subdomain}-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-${page.slug}`,
        canMove: false,
        isFolder: isProjectPageFolder(page, gating),
        children: getProjectPageChildren(org, app, page, gating),
        data: {
          name: page.name,
          icon: page.icon,
          isProjectPage: true,
          targetUrl: getProjectPageUrl(org, app, page),
          disabled: isProjectPageDisabled(page, gating),
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

    projectGraphQLPages.forEach((page) => {
      result[`${org.slug}-${app.subdomain}-graphql-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-graphql-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: page.name,
          targetUrl: getProjectSubPageUrl(org, app, page),
        },
        canRename: false,
      };
    });

    projectEventsPages.forEach((page) => {
      result[`${org.slug}-${app.subdomain}-events-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-events-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: page.name,
          targetUrl: getProjectSubPageUrl(org, app, page),
        },
        canRename: false,
      };
    });

    projectAuthPages.forEach((page) => {
      result[`${org.slug}-${app.subdomain}-auth-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-auth-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: page.name,
          targetUrl: getProjectSubPageUrl(org, app, page),
        },
        canRename: false,
      };
    });

    projectDatabasePages.forEach((page) => {
      result[`${org.slug}-${app.subdomain}-database-${page.slug}`] = {
        index: `${org.slug}-${app.subdomain}-database-${page.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: page.name,
          targetUrl: getProjectSubPageUrl(org, app, page),
        },
        canRename: false,
      };
    });
  });

  result[`${org.slug}-settings`] = {
    index: `${org.slug}-settings`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Settings',
      targetUrl: getOrgSettingsUrl(org),
      disabled: gating.isNotPlatform,
    },
    canRename: false,
  };

  result[`${org.slug}-members`] = {
    index: `${org.slug}-members`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Members',
      targetUrl: getOrgMembersUrl(org),
      disabled: gating.isNotPlatform,
    },
    canRename: false,
  };

  result[`${org.slug}-billing`] = {
    index: `${org.slug}-billing`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Billing',
      targetUrl: getOrgBillingUrl(org),
      disabled: gating.isNotPlatform,
    },
    canRename: false,
  };

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
        children: [
          `${org.slug}-projects`,
          `${org.slug}-settings`,
          `${org.slug}-members`,
          `${org.slug}-billing`,
        ],
        data: { name: 'root' },
        canRename: false,
      },
      ...createOrganization(org),
    },
  };

  return navTree;
};
