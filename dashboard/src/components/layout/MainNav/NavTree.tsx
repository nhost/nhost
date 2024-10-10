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
import { useNavTreeStateFromURL } from '@/features/orgs/projects/hooks/useNavTreeStateFromURL';
import { useOrgs, type Org } from '@/features/orgs/projects/hooks/useOrgs';
import { cn } from '@/lib/utils';
import { dequal } from 'dequal';
import { Box, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState, type ReactElement } from 'react';

import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
  type TreeViewState,
} from 'react-complex-tree';

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
  { name: 'Configuration Editor', slug: 'editor', route: 'editor' },
];

const createOrganization = (org: Org) => {
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
    },
    canRename: false,
  };

  result[`${org.slug}-projects`] = {
    index: `${org.slug}-projects`,
    canMove: false,
    isFolder: true,
    children: org.apps.map((app) => `${org.slug}-${app.slug}`),
    data: {
      name: 'Projects',
      targetUrl: `/orgs/${org.slug}/projects`,
    },
    canRename: false,
  };

  org.apps.forEach((app) => {
    result[`${org.slug}-${app.slug}`] = {
      index: `${org.slug}-${app.slug}`,
      isFolder: true,
      canMove: false,
      canRename: false,
      data: {
        name: app.name,
        slug: app.slug,
        icon: <Box className="h-4 w-4" />,
        targetUrl: `/orgs/${org.slug}/projects/${app.slug}`,
      },
      children: projectPages.map(
        (page) => `${org.slug}-${app.slug}-${page.slug}`,
      ),
    };
  });

  org.apps.forEach((_app) => {
    projectPages.forEach((_page) => {
      result[`${org.slug}-${_app.slug}-${_page.slug}`] = {
        index: `${org.slug}-${_app.slug}-${_page.slug}`,
        canMove: false,
        isFolder: _page.name === 'Settings',
        children:
          _page.name === 'Settings'
            ? projectSettingsPages.map(
                (p) => `${org.slug}-${_app.slug}-settings-${p.slug}`,
              )
            : undefined,
        data: {
          name: _page.name,
          icon: _page.icon,
          isProjectPage: true,
          targetUrl: `/orgs/${org.slug}/projects/${_app.slug}/${_page.route}`,
        },
        canRename: false,
      };
    });

    // add the settings pages
    projectSettingsPages.forEach((p) => {
      result[`${org.slug}-${_app.slug}-settings-${p.slug}`] = {
        index: `${org.slug}-${_app.slug}-settings-${p.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: p.name,
          targetUrl:
            p.slug === 'general'
              ? `/orgs/${org.slug}/projects/${_app.slug}/settings`
              : `/orgs/${org.slug}/projects/${_app.slug}/settings/${p.route}`,
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
};

const buildNavTreeData = (
  orgs: Org[],
): { items: Record<TreeItemIndex, TreeItem<NavItem>> } => {
  const navTree = {
    items: {
      root: {
        index: 'root',
        canMove: false,
        isFolder: true,
        children: ['organizations'],
        data: { name: 'root' },
        canRename: false,
      },
      organizations: {
        index: 'organizations',
        canMove: false,
        isFolder: true,
        children: orgs.map((org) => org.slug),
        data: { name: 'Organizations' },
        canRename: false,
      },
      ...orgs.reduce(
        (acc, org) => ({ ...acc, ...createOrganization(org) }),
        {},
      ),
    },
  };

  return navTree;
};

function useDeepMemo<T>(value: T): T {
  const ref = useRef(value);

  if (!dequal(ref.current, value)) {
    ref.current = value;
  }

  return ref.current;
}

export default function NavTree() {
  const { orgs } = useOrgs();

  // Deeply memoize orgs to avoid unnecessary updates
  const memoizedOrgs = useDeepMemo(orgs);

  // Build the navTree data only when memoizedOrgs changes
  const navTree = useMemo(() => buildNavTreeData(memoizedOrgs), [memoizedOrgs]);

  // Extract navigation state from the URL
  const { expandedItems, focusedItem } = useNavTreeStateFromURL();

  const [viewState, setViewState] = useState<TreeViewState['nav-tree']>({
    expandedItems,
    focusedItem,
    selectedItems: null,
  });

  // Sync the focusedItem and expandedItems from the URL whenever they change.
  useEffect(() => {
    setViewState((prevState) => ({
      ...prevState,
      expandedItems: [
        ...new Set([...prevState.expandedItems, ...expandedItems]),
      ],
      focusedItem,
    }));
  }, [expandedItems, focusedItem]);

  return (
    <ControlledTreeEnvironment
      items={navTree.items}
      getItemTitle={(item) => item.data.name}
      viewState={{
        'nav-tree': viewState,
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
            className="h-8 px-2"
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
          <div className="flex flex-row items-center gap-1">
            {arrow}
            <Button
              asChild
              variant={context.isFocused ? 'secondary' : 'ghost'}
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
              className="flex h-8 w-full flex-row justify-start gap-2 px-1"
            >
              <Link href={item.data.targetUrl || '/'} shallow>
                {item.data.icon && (
                  <span
                    className={cn(
                      'flex items-start',
                      context.isFocused ? 'text-primary-main' : '',
                    )}
                  >
                    {item.data.icon}
                  </span>
                )}
                <span
                  className={cn(
                    item?.index === 'organizations' && 'font-bold',
                    context.isFocused ? 'font-bold text-primary-main' : '',
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
          <div className="flex w-full flex-row gap-1">
            <div className="flex justify-center px-[15px] pb-3">
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
        setViewState(({ expandedItems: prevExpandedItems, ...rest }) => ({
          ...rest,
          // Add item index to expandedItems only if it's not already present
          expandedItems: prevExpandedItems.includes(item.index)
            ? prevExpandedItems
            : [...prevExpandedItems, item.index],
        }));
      }}
      onCollapseItem={(item) => {
        setViewState(({ expandedItems: prevExpandedItems, ...rest }) => ({
          ...rest,
          // Remove the item index from expandedItems
          expandedItems: prevExpandedItems.filter(
            (index) => index !== item.index,
          ),
        }));
      }}
      onFocusItem={(item) => {
        setViewState((prevViewState) => ({
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
