import {
  SiGraphql as GraphQLIcon,
  SiHasura as HasuraIcon,
  SiDocker as ServicesIcon,
} from '@icons-pack/react-simple-icons';
import {
  Sparkles as AIIcon,
  Code,
  DatabaseIcon,
  FileTextIcon,
  GaugeIcon,
  HomeIcon,
  RocketIcon,
  HardDrive as StorageIcon,
  UserIcon,
  Zap,
} from 'lucide-react';
import type { ReactElement } from 'react';

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
    name: 'Actions',
    slug: 'actions',
    route: 'graphql/actions',
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
  {
    name: 'SQL Console',
    slug: 'sql-console',
    route: 'database/browser/default/editor',
  },
  {
    name: 'Backups',
    slug: 'backups',
    route: 'database/backups',
    gate: 'platform',
  },
  {
    name: 'Settings',
    slug: 'settings',
    route: 'database/settings',
    gate: 'settings',
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
  { name: 'Projects', slug: 'projects', route: 'projects', gate: 'platform' },
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

type ProjectPage = (typeof projectPages)[number];

export const getOrgUrl = (orgSlug: string) => `/orgs/${orgSlug}`;

export const getProjectUrl = (orgSlug: string, appSubdomain: string) =>
  `${getOrgUrl(orgSlug)}/projects/${appSubdomain}`;

export const getSettingsPageRoute = (page: { route: string }) =>
  page.route ? `settings/${page.route}` : 'settings';

export const projectSubPagesBySlug = {
  database: projectDatabasePages,
  graphql: projectGraphQLPages,
  events: projectEventsPages,
  auth: projectAuthPages,
  ai: projectAIPages,
} satisfies Partial<Record<ProjectPage['slug'], ReadonlyArray<PageEntry>>>;
