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
import { useOrgs, type Org } from '@/features/projects/common/hooks/useOrgs';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';
import { Box, ChevronDown, ChevronRight } from 'lucide-react';
import { useEffect, type ReactElement } from 'react';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
} from 'react-complex-tree';

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

const createOrganization = (org: Org) => {
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
      isFree: org.plan.isFree,
      plan: org.plan.name,
    },
    canRename: false,
  };

  result[`${org.name}-projects`] = {
    index: `${org.name}-projects`,
    canMove: false,
    isFolder: true,
    children: org.plan.apps.map((app) => `${org.name}-${app.name}`),
    data: {
      name: 'Projects',
    },
    canRename: false,
  };

  org.plan.apps.forEach((app) => {
    result[`${org.name}-${app.name}`] = {
      index: `${org.name}-${app.name}`,
      isFolder: true,
      canMove: false,
      canRename: false,
      data: { name: app.name, icon: <Box className="h-4 w-4" /> },
      children: projectPages.map(
        (page) => `${org.name}-${app.name}-${page.name}`,
      ),
    };
  });

  org.plan.apps.forEach((_app) => {
    projectPages.forEach((_page) => {
      result[`${org.name}-${_app.name}-${_page.name}`] = {
        index: `${org.name}-${_app.name}-${_page.name}`,
        canMove: false,
        isFolder: _page.name === 'Settings',
        children:
          _page.name === 'Settings'
            ? projectSettingsPages.map(
                (p) => `${org.name}-${_app.name}-settings-${p}`,
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
      result[`${org.name}-${_app.name}-settings-${p}`] = {
        index: `${org.name}-${_app.name}-settings-${p}`,
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

const buildNavTreeData = (
  orgs: Org[],
): { items: Record<TreeItemIndex, TreeItem<NavItem>> } => {
  const navTree = {
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
        children: orgs.map((org) => org.name),
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

export default function NavTree() {
  const { orgs } = useOrgs();
  const navTree = buildNavTreeData(orgs);

  const [focusedItem, setFocusedItem] = useSSRLocalStorage(
    'nav-tree-focused-item',
    null,
  );

  const [expandedItems, setExpandedItems] = useSSRLocalStorage(
    'nav-tree-expanded-items',
    null,
  );

  const [selectedItems, setSelectedItems] = useSSRLocalStorage(
    'nav-tree-selected-items',
    [],
  );

  useEffect(() => {
    if (orgs?.length > 0) {
      if (!expandedItems) {
        setExpandedItems(['Organizations', orgs[0].name]);
      }

      if (!focusedItem) {
        setFocusedItem(`${orgs[0].name}-projects`);
      }
    }
  }, [orgs, expandedItems, focusedItem, setExpandedItems, setFocusedItem]);

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
      renderItem={({ arrow, context, item, children }) => (
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
                  'max-w-52 truncate', // Add this utility for ellipsis
                )}
                style={{
                  whiteSpace: 'nowrap',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                }}
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
