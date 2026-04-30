import { ChevronDown, ChevronRight, Code, Zap } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
} from 'react-complex-tree';
import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { CloudIcon } from '@/components/ui/v2/icons/CloudIcon';
import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { FileTextIcon } from '@/components/ui/v2/icons/FileTextIcon';
import { GaugeIcon } from '@/components/ui/v2/icons/GaugeIcon';
import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import { HasuraIcon } from '@/components/ui/v2/icons/HasuraIcon';
import { HomeIcon } from '@/components/ui/v2/icons/HomeIcon';
import { RocketIcon } from '@/components/ui/v2/icons/RocketIcon';
import { ServicesIcon } from '@/components/ui/v2/icons/ServicesIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { Button } from '@/components/ui/v3/button';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { getConfigServerUrl, isPlatform as getIsPlatform } from '@/utils/env';
import ProjectSwitcher from './ProjectSwitcher';
import { useTreeNavState } from './TreeNavStateContext';

type ProjectPage = {
  name: string;
  icon?: ReactElement;
  route: string;
  slug: string;
};

const projectPages: ProjectPage[] = [
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

const projectSettingsPages = [
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
  { name: 'Git', slug: 'git', route: 'git' },
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

const projectGraphQLPages = [
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

const projectEventsPages = [
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

const projectAuthPages = [
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

type NavItem = {
  name: string;
  icon?: ReactElement;
  targetUrl?: string;
  disabled?: boolean;
};

type BuildOptions = {
  orgSlug: string;
  appSubdomain: string;
  shouldDisableSettings: boolean;
  shouldDisableGraphite: boolean;
  isNotPlatform: boolean;
};

const FOLDER_PAGES = new Set(['settings', 'graphql', 'events', 'auth']);

const buildProjectTree = ({
  orgSlug,
  appSubdomain,
  shouldDisableSettings,
  shouldDisableGraphite,
  isNotPlatform,
}: BuildOptions): { items: Record<TreeItemIndex, TreeItem<NavItem>> } => {
  const items: Record<TreeItemIndex, TreeItem<NavItem>> = {};

  items.root = {
    index: 'root',
    canMove: false,
    isFolder: true,
    children: projectPages.map((page) => page.slug),
    data: { name: 'root' },
    canRename: false,
  };

  projectPages.forEach((page) => {
    const isSettingsFolder = page.slug === 'settings' && !shouldDisableSettings;
    const isFolder = isSettingsFolder || FOLDER_PAGES.has(page.slug);

    let children: string[] | undefined;
    if (isSettingsFolder) {
      children = projectSettingsPages.map((p) => `settings-${p.slug}`);
    } else if (page.slug === 'graphql') {
      children = projectGraphQLPages.map((p) => `graphql-${p.slug}`);
    } else if (page.slug === 'events') {
      children = projectEventsPages.map((p) => `events-${p.slug}`);
    } else if (page.slug === 'auth') {
      children = projectAuthPages.map((p) => `auth-${p.slug}`);
    }

    items[page.slug] = {
      index: page.slug,
      canMove: false,
      isFolder,
      children,
      data: {
        name: page.name,
        icon: page.icon,
        targetUrl: `/orgs/${orgSlug}/projects/${appSubdomain}/${page.route}`,
        disabled:
          (['deployments', 'backups', 'logs', 'metrics'].includes(page.slug) &&
            isNotPlatform) ||
          (page.slug === 'settings' && shouldDisableSettings) ||
          (page.slug === 'ai' && shouldDisableGraphite),
      },
      canRename: false,
    };
  });

  projectSettingsPages.forEach((p) => {
    items[`settings-${p.slug}`] = {
      index: `settings-${p.slug}`,
      canMove: false,
      isFolder: false,
      children: undefined,
      data: {
        name: p.name,
        targetUrl:
          p.slug === 'general'
            ? `/orgs/${orgSlug}/projects/${appSubdomain}/settings`
            : `/orgs/${orgSlug}/projects/${appSubdomain}/settings/${p.route}`,
        disabled: shouldDisableSettings,
      },
      canRename: false,
    };
  });

  projectGraphQLPages.forEach((p) => {
    items[`graphql-${p.slug}`] = {
      index: `graphql-${p.slug}`,
      canMove: false,
      isFolder: false,
      children: undefined,
      data: {
        name: p.name,
        targetUrl: `/orgs/${orgSlug}/projects/${appSubdomain}/${p.route}`,
      },
      canRename: false,
    };
  });

  projectEventsPages.forEach((p) => {
    items[`events-${p.slug}`] = {
      index: `events-${p.slug}`,
      canMove: false,
      isFolder: false,
      children: undefined,
      data: {
        name: p.name,
        targetUrl: `/orgs/${orgSlug}/projects/${appSubdomain}/${p.route}`,
      },
      canRename: false,
    };
  });

  projectAuthPages.forEach((p) => {
    items[`auth-${p.slug}`] = {
      index: `auth-${p.slug}`,
      canMove: false,
      isFolder: false,
      children: undefined,
      data: {
        name: p.name,
        targetUrl: `/orgs/${orgSlug}/projects/${appSubdomain}/${p.route}`,
      },
      canRename: false,
    };
  });

  return { items };
};

const emptyTree: { items: Record<TreeItemIndex, TreeItem<NavItem>> } = {
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

export default function NavTree() {
  const router = useRouter();

  const orgSlug = router.query.orgSlug as string | undefined;
  const appSubdomain = router.query.appSubdomain as string | undefined;

  const isNotPlatform = !getIsPlatform();
  const configServerVariableNotSet = getConfigServerUrl() === '';
  const shouldDisableSettings = isNotPlatform && configServerVariableNotSet;
  const shouldDisableGraphite = shouldDisableSettings;

  const navTree =
    orgSlug && appSubdomain
      ? buildProjectTree({
          orgSlug,
          appSubdomain,
          shouldDisableSettings,
          shouldDisableGraphite,
          isNotPlatform,
        })
      : emptyTree;

  const { orgsTreeViewState, setOrgsTreeViewState, setOpen } =
    useTreeNavState();

  return (
    <div className="flex flex-col gap-2">
      {appSubdomain && <ProjectSwitcher />}

      <ControlledTreeEnvironment
        items={navTree.items}
        getItemTitle={(item) => item.data.name}
        viewState={{
          'nav-tree': orgsTreeViewState,
        }}
        renderItemTitle={({ title }) => <span>{title}</span>}
        renderItemArrow={({ item, context }) => {
          if (!item.isFolder) {
            return null;
          }

          return (
            <Button
              type="button"
              variant="ghost"
              onClick={() => context.toggleExpandedState()}
              className="h-8 px-1"
            >
              {context.isExpanded ? (
                <ChevronDown className="h-4 w-4 font-bold" strokeWidth={3} />
              ) : (
                <ChevronRight className="h-4 w-4" strokeWidth={3} />
              )}
            </Button>
          );
        }}
        renderItem={({ arrow, context, item, children }) => (
          <li
            {...context.itemContainerWithChildrenProps}
            className="flex flex-col gap-1"
          >
            <div className="flex flex-row items-center">
              {arrow}
              <Button
                asChild
                onClick={() => {
                  if (
                    navTree.items[item.index].data.targetUrl ===
                    item.data.targetUrl
                  ) {
                    return;
                  }

                  if (
                    item.isFolder &&
                    FOLDER_PAGES.has(item.index as string) &&
                    !context.isExpanded
                  ) {
                    context.toggleExpandedState();
                  }

                  context.focusItem();
                }}
                className={cn(
                  'flex h-8 min-w-0 flex-1 flex-row justify-start gap-2 bg-background px-2 text-foreground hover:bg-accent',
                  {
                    'bg-[#ebf3ff] hover:bg-accent dark:bg-muted':
                      context.isFocused,
                  },
                  item.data.disabled && 'pointer-events-none opacity-50',
                )}
              >
                <Link
                  href={item.data.targetUrl || '/'}
                  shallow
                  onClick={() => setOpen(false)}
                >
                  {item.data.icon && (
                    <span
                      className={cn(
                        'flex items-start',
                        context.isFocused ? 'text-primary' : '',
                      )}
                    >
                      {item.data.icon}
                    </span>
                  )}
                  <span
                    className={cn(
                      context.isFocused ? 'font-bold text-primary' : '',
                      'max-w-52 truncate',
                    )}
                  >
                    {item.data.name}
                  </span>
                </Link>
              </Button>
            </div>
            <div>{children}</div>
          </li>
        )}
        renderTreeContainer={({ children, containerProps }) => (
          <div {...containerProps} className="w-full">
            {children}
          </div>
        )}
        renderItemsContainer={({ children, containerProps, depth }) => {
          if (depth === 0) {
            return (
              <ul {...containerProps} className="w-full">
                {children}
              </ul>
            );
          }

          return (
            <div className="flex w-full flex-row">
              <div className="flex justify-center px-[12px] pb-3">
                <div className="h-full w-0 border-r border-dashed" />
              </div>
              <ul {...containerProps} className="w-full">
                {children}
              </ul>
            </div>
          );
        }}
        canSearch={false}
        onExpandItem={(item) => {
          setOrgsTreeViewState(
            ({ expandedItems: prevExpandedItems, ...rest }) => {
              const newExpandedItems = isNotEmptyValue(prevExpandedItems)
                ? [...prevExpandedItems]
                : [];

              return {
                ...rest,
                expandedItems: newExpandedItems?.includes(item.index)
                  ? prevExpandedItems
                  : [...newExpandedItems, item.index],
              };
            },
          );
        }}
        onCollapseItem={(item) => {
          setOrgsTreeViewState(
            ({ expandedItems: prevExpandedItems, ...rest }) => ({
              ...rest,
              expandedItems: (prevExpandedItems ?? []).filter(
                (index) => index !== item.index,
              ),
            }),
          );
        }}
        onFocusItem={(item) => {
          setOrgsTreeViewState((prevViewState) => ({
            ...prevViewState,
            focusedItem: item.index,
          }));
        }}
      >
        <Tree
          treeId="nav-tree"
          rootItem="root"
          treeLabel="Project navigation"
        />
      </ControlledTreeEnvironment>
    </div>
  );
}
