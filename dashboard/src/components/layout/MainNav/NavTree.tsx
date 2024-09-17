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
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';
import { Box, ChevronDown, ChevronRight } from 'lucide-react';
import { type ReactElement } from 'react';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
} from 'react-complex-tree';

const orgs = [
  {
    name: "Hassan's org",
    isFree: false,
    plan: 'Pro',
    projects: [
      { name: 'eu-central-1.celsia' },
      { name: 'joyent' },
      { name: 'react-apollo' },
    ],
  },
  { name: 'nhost-testing', isFree: true, plan: 'Starter', projects: [] },
  { name: 'uflip', isFree: false, plan: 'Team', projects: [] },
];

const projectPages = [
  {
    name: 'Overview',
    icon: <HomeIcon className="h-4 w-4" />,
    isProjectPage: true,
  },
  { name: 'Database', icon: <DatabaseIcon className="h-4 w-4" /> },
  { name: 'GraphQL', icon: <GraphQLIcon className="h-4 w-4" /> },
  { name: 'Hasura', icon: <HasuraIcon className="h-4 w-4" /> },
  { name: 'Auth', icon: <UserIcon className="h-4 w-4" /> },
  { name: 'Storage', icon: <StorageIcon className="h-4 w-4" /> },
  { name: 'Run', icon: <ServicesIcon className="h-4 w-4" /> },
  { name: 'AI', icon: <AIIcon className="h-4 w-4" /> },
  { name: 'Deployments', icon: <RocketIcon className="h-4 w-4" /> },
  { name: 'Backups', icon: <CloudIcon className="h-4 w-4" /> },
  { name: 'Logs', icon: <FileTextIcon className="h-4 w-4" /> },
  { name: 'Metrics', icon: <GaugeIcon className="h-4 w-4" /> },
  {
    name: 'Settings',
    // icon: <CogIcon className="w-4 h-4" />
  },
];

const projectSettingsPages = [
  'General',
  'Compute Resources',
  'Database',
  'Hasura',
  'Authentication',
  'Sign-In methods',
  'Roles and Permissions',
  'SMTP',
  'Serverless Functions',
  'Git',
  'Environment Variables',
  'Secrets',
  'Custom Domains',
  'Rate Limiting',
  'AI',
];

const createOrganization = (org: any) => {
  const result = {};

  result[org.name] = {
    index: org.name,
    canMove: false,
    isFolder: true,
    children: [
      `${org.name}-projects`,
      `${org.name}-settings`,
      `${org.name}-members`,
      `${org.name}-billing`,
    ],
    data: {
      name: org.name,
      type: 'org',
      isFree: org.isFree,
      plan: org.plan,
    },
    canRename: false,
  };

  result[`${org.name}-projects`] = {
    index: `${org.name}-projects`,
    canMove: false,
    isFolder: true,
    children: org.projects.map((project) => `${org.name}-${project.name}`),
    data: {
      name: 'Projects',
    },
    canRename: false,
  };

  org.projects.forEach((project) => {
    result[`${org.name}-${project.name}`] = {
      index: `${org.name}-${project.name}`,
      isFolder: true,
      canMove: false,
      canRename: false,
      data: { name: project.name, icon: <Box className="h-4 w-4" /> },
      children: projectPages.map(
        (page) => `${org.name}-${project.name}-${page.name}`,
      ),
    };
  });

  org.projects.forEach((_project) => {
    projectPages.forEach((_page) => {
      result[`${org.name}-${_project.name}-${_page.name}`] = {
        index: `${org.name}-${_project.name}-${_page.name}`,
        canMove: false,
        isFolder: _page.name === 'Settings',
        children:
          _page.name === 'Settings'
            ? projectSettingsPages.map(
                (p) => `${org.name}-${_project.name}-settings-${p}`,
              )
            : undefined,
        data: {
          name: _page.name,
          icon: _page.icon,
          isProjectPage: true,
        },
        canRename: false,
      };
    });

    // add the settings pages
    projectSettingsPages.forEach((p) => {
      result[`${org.name}-${_project.name}-settings-${p}`] = {
        index: `${org.name}-${_project.name}-settings-${p}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: p,
        },
        canRename: false,
      };
    });
  });

  result[`${org.name}-settings`] = {
    index: `${org.name}-settings`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Settings',
    },
    canRename: false,
  };

  result[`${org.name}-members`] = {
    index: `${org.name}-members`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Members',
    },
    canRename: false,
  };

  result[`${org.name}-billing`] = {
    index: `${org.name}-billing`,
    canMove: false,
    isFolder: false,
    children: [],
    data: {
      name: 'Billing',
    },
    canRename: false,
  };

  return result;
};

type NavItem = {
  name: string;
  type?: string;
  isFree?: boolean;
  plan?: string;
  icon?: ReactElement;
};

// Initialize navTree
const navTree: { items: Record<TreeItemIndex, TreeItem<NavItem>> } = {
  items: {
    root: {
      index: 'root',
      canMove: false,
      isFolder: true,
      children: ['Organizations'],
      data: { name: 'root' },
      canRename: false,
    },
    Organizations: {
      index: 'Organizations',
      canMove: false,
      isFolder: true,
      children: orgs.map((org) => org.name), // Link organization names
      data: { name: 'Organizations' },
      canRename: false,
    },
    ...orgs.reduce((acc, org) => ({ ...acc, ...createOrganization(org) }), {}),
  },
};

export default function NavTree() {
  const [focusedItem, setFocusedItem] = useSSRLocalStorage(
    'nav-tree-focused-item',
    null,
  );
  const [expandedItems, setExpandedItems] = useSSRLocalStorage(
    'nav-tree-expanded-items',
    ['Organizations', orgs[0].name, `${orgs[0].name}-projects`],
  );
  const [selectedItems, setSelectedItems] = useSSRLocalStorage(
    'nav-tree-selected-items',
    [],
  );

  return (
    <ControlledTreeEnvironment
      items={navTree.items}
      getItemTitle={(item) => item.data.name}
      viewState={{
        'nav-tree': {
          focusedItem,
          expandedItems,
          selectedItems,
        },
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
      renderItem={({ title, arrow, context, item, children }) => (
        <li
          {...context.itemContainerWithChildrenProps}
          className="flex flex-col gap-1"
        >
          <div className="flex flex-row items-center gap-1">
            {arrow}
            <Button
              variant={context.isFocused ? 'secondary' : 'ghost'}
              onClick={() => {
                if (item.data.type === 'org') {
                  context.toggleExpandedState();
                } else {
                  context.focusItem();
                }
              }}
              className="flex h-8 w-full flex-row justify-start gap-2 px-1"
            >
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
                  item.index === 'Organizations' && 'font-bold',
                  context.isFocused ? 'font-bold text-primary-main' : '',
                )}
              >
                {title}
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
      onFocusItem={(item) => setFocusedItem(item.index)}
      onExpandItem={(item) =>
        setExpandedItems([...expandedItems, item.index as string])
      }
      onCollapseItem={(item) =>
        setExpandedItems(
          expandedItems.filter(
            (expandedItemIndex) => expandedItemIndex !== item.index,
          ),
        )
      }
      onSelectItems={(items) => setSelectedItems(items)}
    >
      <Tree treeId="nav-tree" rootItem="root" treeLabel="Navigation Tree" />
    </ControlledTreeEnvironment>
  );
}
