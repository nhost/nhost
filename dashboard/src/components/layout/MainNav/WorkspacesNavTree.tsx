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
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from '@/components/ui/v3/hover-card';
import { useWorkspaces } from '@/features/orgs/projects/hooks/useWorkspaces';
import { type Workspace } from '@/features/orgs/projects/hooks/useWorkspaces/useWorkspaces';
import { cn } from '@/lib/utils';
import { Box, ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { type ReactElement } from 'react';

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
    icon: <HomeIcon className="w-4 h-4" />,
    route: '',
    slug: 'overview',
  },
  {
    name: 'Database',
    icon: <DatabaseIcon className="w-4 h-4" />,
    route: 'database/browser/default',
    slug: 'database',
  },
  {
    name: 'GraphQL',
    icon: <GraphQLIcon className="w-4 h-4" />,
    route: 'graphql',
    slug: 'graphql',
  },
  {
    name: 'Hasura',
    icon: <HasuraIcon className="w-4 h-4" />,
    route: 'hasura',
    slug: 'hasura',
  },
  {
    name: 'Auth',
    icon: <UserIcon className="w-4 h-4" />,
    route: 'users',
    slug: 'users',
  },
  {
    name: 'Storage',
    icon: <StorageIcon className="w-4 h-4" />,
    route: 'storage',
    slug: 'storage',
  },
  {
    name: 'Run',
    icon: <ServicesIcon className="w-4 h-4" />,
    route: 'services',
    slug: 'services',
  },
  {
    name: 'AI',
    icon: <AIIcon className="w-4 h-4" />,
    route: 'ai/auto-embeddings',
    slug: 'ai',
  },
  {
    name: 'Deployments',
    icon: <RocketIcon className="w-4 h-4" />,
    route: 'deployments',
    slug: 'deployments',
  },
  {
    name: 'Backups',
    icon: <CloudIcon className="w-4 h-4" />,
    route: 'backups',
    slug: 'backups',
  },
  {
    name: 'Logs',
    icon: <FileTextIcon className="w-4 h-4" />,
    route: 'logs',
    slug: 'logs',
  },
  {
    name: 'Metrics',
    icon: <GaugeIcon className="w-4 h-4" />,
    route: 'metrics',
    slug: 'metrics',
  },
  {
    name: 'Settings',
    route: 'settings/general',
    slug: 'settings',
  },
];

const projectSettingsPages = [
  { name: 'General', slug: 'general', route: 'general' },
  {
    name: 'Compute Resources',
    slug: 'resources',
    route: 'resources',
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

const createWorkspace = (workspace: Workspace) => {
  const result = {};

  result[workspace.slug] = {
    index: workspace.slug,
    canMove: false,
    isFolder: true,
    children: [`${workspace.slug}-overview`, `${workspace.slug}-projects`],
    data: {
      name: workspace.name,
      slug: workspace.slug,
      type: 'workspace',
      targetUrl: `/${workspace.slug}`,
    },
    canRename: false,
  };

  result[`${workspace.slug}-overview`] = {
    index: `${workspace.slug}-overview`,
    canMove: false,
    isFolder: false,
    children: null,
    data: {
      name: 'Overview',
      targetUrl: `/${workspace.slug}`,
    },
    canRename: false,
  };

  result[`${workspace.slug}-projects`] = {
    index: `${workspace.slug}-projects`,
    canMove: false,
    isFolder: true,
    children: workspace.projects.map((app) => `${workspace.slug}-${app.slug}`),
    data: {
      name: 'Projects',
    },
    canRename: false,
  };

  workspace.projects.forEach((app) => {
    result[`${workspace.slug}-${app.slug}`] = {
      index: `${workspace.slug}-${app.slug}`,
      isFolder: true,
      canMove: false,
      canRename: false,
      data: {
        name: app.name,
        slug: app.slug,
        icon: <Box className="w-4 h-4" />,
        targetUrl: `/${workspace.slug}/${app.slug}`,
      },
      children: projectPages.map(
        (page) => `${workspace.slug}-${app.slug}-${page.slug}`,
      ),
    };
  });

  workspace.projects.forEach((_app) => {
    projectPages.forEach((_page) => {
      result[`${workspace.slug}-${_app.slug}-${_page.slug}`] = {
        index: `${workspace.slug}-${_app.slug}-${_page.slug}`,
        canMove: false,
        isFolder: _page.name === 'Settings',
        children:
          _page.name === 'Settings'
            ? projectSettingsPages.map(
                (p) => `${workspace.slug}-${_app.slug}-settings-${p.slug}`,
              )
            : undefined,
        data: {
          name: _page.name,
          icon: _page.icon,
          isProjectPage: true,
          targetUrl: `/${workspace.slug}/${_app.slug}/${_page.route}`,
        },
        canRename: false,
      };
    });

    // add the settings pages
    projectSettingsPages.forEach((p) => {
      result[`${workspace.slug}-${_app.slug}-settings-${p.slug}`] = {
        index: `${workspace.slug}-${_app.slug}-settings-${p.slug}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: p.name,
          targetUrl: `/${workspace.slug}/${_app.slug}/settings/${p.route}`,
        },
        canRename: false,
      };
    });
  });

  return result;
};

type NavItem = {
  name: string;
  slug?: string;
  type?: string;
  icon?: ReactElement;
  targetUrl?: string;
};

const buildNavTreeData = (
  workspaces: Workspace[],
): { items: Record<TreeItemIndex, TreeItem<NavItem>> } => {
  const navTree = {
    items: {
      root: {
        index: 'root',
        canMove: false,
        isFolder: true,
        children: ['workspaces'],
        data: { name: 'root' },
        canRename: false,
      },
      workspaces: {
        index: 'workspaces',
        canMove: false,
        isFolder: true,
        children: workspaces.map((workspace) => workspace.slug),
        data: { name: 'Workspaces', type: 'workspaces-root' },
        canRename: false,
      },
      ...workspaces.reduce(
        (acc, workspace) => ({ ...acc, ...createWorkspace(workspace) }),
        {},
      ),
    },
  };

  return navTree;
};

export default function WorkspacesNavTree() {
  const { workspaces } = useWorkspaces();
  const navTree = buildNavTreeData(workspaces);

  const { workspacesTreeViewState, setWorkspacesTreeViewState } =
    useTreeNavState();

  const renderItem = ({ arrow, context, item, children }) => {
    const navItemContent = () => (
      <>
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
            item?.index === 'workspaces' && 'font-bold',
            context.isFocused ? 'font-bold text-primary-main' : '',
            'max-w-52 truncate',
          )}
        >
          {item.data.name}
        </span>
        {item.data.type === 'workspaces-root' && (
          <HoverCard openDelay={0}>
            <HoverCardTrigger asChild>
              <div
                className={cn(
                  'h-5 rounded-full bg-muted bg-orange-200 px-[6px] text-[10px] dark:bg-orange-500',
                )}
              >
                Legacy
              </div>
            </HoverCardTrigger>
            <HoverCardContent className="w-64" side="top">
              <div className="whitespace-normal">
                <p>These are your legacy workspaces. Read the announcement.</p>
              </div>
            </HoverCardContent>
          </HoverCard>
        )}
      </>
    );

    return (
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
              // if (item.data.type === 'workspace' || !item.data.targetUrl) {
              //   context.toggleExpandedState();
              // } else {
              //   context.focusItem();
              // }
              if (item.data.type !== 'workspace') {
                context.focusItem();
              }
            }}
            className="flex flex-row justify-start w-full h-8 gap-2 px-1"
          >
            {item.data.targetUrl ? (
              <Link href={item.data.targetUrl || '/'}>{navItemContent()}</Link>
            ) : (
              <div className="cursor-pointer">{navItemContent()}</div>
            )}
          </Button>
        </div>
        <div>{children}</div>
      </li>
    );
  };

  return (
    <ControlledTreeEnvironment
      items={navTree.items}
      getItemTitle={(item) => item.data.name}
      viewState={{
        'workspaces-nav-tree': workspacesTreeViewState,
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
              <ChevronDown className="w-4 h-4 font-bold" strokeWidth={3} />
            ) : (
              <ChevronRight className="w-4 h-4" strokeWidth={3} />
            )}
          </Button>
        );
      }}
      renderItem={renderItem}
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
          <div className="flex flex-row w-full gap-1">
            <div className="flex justify-center px-[15px] pb-3">
              <div className="w-0 h-full border-r border-dashed" />
            </div>
            <ul {...containerProps} className="w-full">
              {children}
            </ul>
          </div>
        );
      }}
      canSearch={false}
      onExpandItem={(item) => {
        setWorkspacesTreeViewState(
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
        setWorkspacesTreeViewState(
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
        setWorkspacesTreeViewState((prevViewState) => ({
          ...prevViewState,
          // Set the focused item
          focusedItem: item.index,
        }));
      }}
    >
      <Tree
        rootItem="root"
        treeId="workspaces-nav-tree"
        treeLabel="Workspaces Navigation Tree"
      />
    </ControlledTreeEnvironment>
  );
}
