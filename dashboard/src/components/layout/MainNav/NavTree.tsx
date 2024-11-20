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
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useOrgs, type Org } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { Box, ChevronDown, ChevronRight, Plus } from 'lucide-react';
import Link from 'next/link';
import { useMemo, type ReactElement } from 'react';

import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
} from 'react-complex-tree';
import { useTreeNavState } from './TreeNavStateContext';

const projectPages = [
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
    name: 'Hasura',
    icon: <HasuraIcon className="h-4 w-4" />,
    route: 'hasura',
    slug: 'hasura',
  },
  {
    name: 'Auth',
    icon: <UserIcon className="h-4 w-4" />,
    route: 'users',
    slug: 'users',
  },
  {
    name: 'Storage',
    icon: <StorageIcon className="h-4 w-4" />,
    route: 'storage',
    slug: 'storage',
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
  { name: 'Storage', slug: 'storage', route: 'storage' },
  {
    name: 'Roles and Permissions',
    slug: 'roles-and-permissions',
    route: 'roles-and-permissions',
  },
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

const createOrganization = (org: Org, isPlatform: boolean) => {
  const result = {};

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
      targetUrl: `/orgs/${org.slug}/projects`, // default to projects
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
      targetUrl: `/orgs/${org.slug}/projects`,
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
      targetUrl: `/orgs/${org.slug}/projects/new`,
      disabled: !isPlatform,
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
        targetUrl: `/orgs/${org.slug}/projects/${app.subdomain}`,
      },
      children: projectPages.map(
        (page) => `${org.slug}-${app.subdomain}-${page.slug}`,
      ),
    };
  });

  org.apps.forEach((_app) => {
    projectPages.forEach((_page) => {
      result[`${org.slug}-${_app.subdomain}-${_page.slug}`] = {
        index: `${org.slug}-${_app.subdomain}-${_page.slug}`,
        canMove: false,
        isFolder: _page.name === 'Settings',
        children:
          _page.name === 'Settings'
            ? projectSettingsPages.map(
                (p) => `${org.slug}-${_app.subdomain}-settings-${p.slug}`,
              )
            : undefined,
        data: {
          name: _page.name,
          icon: _page.icon,
          isProjectPage: true,
          targetUrl: `/orgs/${org.slug}/projects/${_app.subdomain}/${_page.route}`,
          disabled:
            ['deployments', 'backups', 'logs', 'metrics'].includes(
              _page.slug,
            ) && !isPlatform,
        },
        canRename: false,
      };
    });

    // add the settings pages
    projectSettingsPages.forEach((p) => {
      result[`${org.slug}-${_app.subdomain}-settings-${p.slug}`] = {
        index: `${org.slug}-${_app.subdomain}-settings-${p.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: p.name,
          targetUrl:
            p.slug === 'general'
              ? `/orgs/${org.slug}/projects/${_app.subdomain}/settings`
              : `/orgs/${org.slug}/projects/${_app.subdomain}/settings/${p.route}`,
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
      targetUrl: `/orgs/${org.slug}/settings`,
      disabled: !isPlatform,
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
      targetUrl: `/orgs/${org.slug}/members`,
      disabled: !isPlatform,
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
      targetUrl: `/orgs/${org.slug}/billing`,
      disabled: !isPlatform,
    },
    canRename: false,
  };

  return result;
};

type NavItem = {
  name: string;
  slug?: string;
  type?: string;
  isFree?: boolean;
  plan?: string;
  icon?: ReactElement;
  targetUrl?: string;
  disabled?: boolean;
};

const buildNavTreeData = (
  org: Org,
  isPlatform: boolean,
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
      ...createOrganization(org, isPlatform),
    },
  };

  return navTree;
};

export default function NavTree() {
  const { currentOrg: org } = useOrgs();
  const isPlatform = useIsPlatform();
  const navTree = useMemo(
    () => buildNavTreeData(org, isPlatform),
    [org, isPlatform],
  );
  const { orgsTreeViewState, setOrgsTreeViewState, setOpen } =
    useTreeNavState();

  return (
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
                // do not focus an item if we already there
                // this will prevent the case where clikcing on the project name
                // would focus on the project name instead of the overview page
                if (
                  navTree.items[item.index].data.targetUrl ===
                  item.data.targetUrl
                ) {
                  return;
                }

                if (item.data.type !== 'org') {
                  context.focusItem();
                }
              }}
              className={cn(
                'flex h-8 w-full flex-row justify-start gap-1 bg-background px-1 text-foreground hover:bg-accent dark:hover:bg-muted',
                context.isFocused &&
                  'bg-[#ebf3ff] hover:bg-[#ebf3ff] dark:bg-muted',
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
                    item?.index === 'organizations' && 'font-bold',
                    context.isFocused ? 'font-bold text-primary' : '',
                    'max-w-52 truncate',
                  )}
                >
                  {item.data.name}
                </span>
                {item.data?.plan && (
                  <Badge
                    variant={item.data.isFree ? 'outline' : 'default'}
                    className={cn(
                      'h-5 px-[6px] text-[10px]',
                      item.data.isFree ? 'bg-muted' : '',
                    )}
                  >
                    {item.data.plan}
                  </Badge>
                )}
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
          ({ expandedItems: prevExpandedItems, ...rest }) => ({
            ...rest,
            // Add item index to expandedItems only if it's not already present
            expandedItems: prevExpandedItems.includes(item.index)
              ? prevExpandedItems
              : [...prevExpandedItems, item.index],
          }),
        );
      }}
      onCollapseItem={(item) => {
        setOrgsTreeViewState(
          ({ expandedItems: prevExpandedItems, ...rest }) => ({
            ...rest,
            // Remove the item index from expandedItems
            expandedItems: prevExpandedItems.filter(
              (index) => index !== item.index,
            ),
          }),
        );
      }}
      onFocusItem={(item) => {
        setOrgsTreeViewState((prevViewState) => ({
          ...prevViewState,
          // Set the focused item
          focusedItem: item.index,
        }));
      }}
    >
      <Tree treeId="nav-tree" rootItem="root" treeLabel="Navigation Tree" />
    </ControlledTreeEnvironment>
  );
}
