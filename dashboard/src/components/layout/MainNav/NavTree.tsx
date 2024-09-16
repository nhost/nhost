import { AIIcon } from '@/components/ui/v2/icons/AIIcon';
import { CloudIcon } from '@/components/ui/v2/icons/CloudIcon';
import { CogIcon } from '@/components/ui/v2/icons/CogIcon';
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
import { cn } from '@/lib/utils';
import { ChevronDown, ChevronRight } from 'lucide-react';
import {
  StaticTreeDataProvider,
  Tree,
  UncontrolledTreeEnvironment,
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
  { name: 'Settings', icon: <CogIcon className="h-4 w-4" /> },
];

// TODO add the settings sub pages
// const projectSettingsPages = [
//   'General',
//   'Compute Resources',
//   'Database',
//   'Hasura',
//   'Authentication',
//   'Sign-In methods',
//   'Roles and Permissions',
//   'SMTP',
//   'Serverless Functions',
//   'Git',
//   'Environment Variables',
//   'Secrets',
//   'Custom Domains',
//   'Rate Limiting',
//   'AI',
// ];

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
      data: { name: project.name },
      children: projectPages.map(
        (page) => `${org.name}-${project.name}-${page.name}`,
      ), // Link project page names
    };
  });

  org.projects.forEach((_project) => {
    projectPages.forEach((_page) => {
      result[`${org.name}-${_project.name}-${_page.name}`] = {
        index: `${org.name}-${_project.name}-${_page.name}`,
        canMove: false,
        isFolder: false,
        children: undefined,
        data: {
          name: _page.name,
          icon: _page.icon,
          isProjectPage: true,
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

// Initialize navTree
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
      children: orgs.map((org) => org.name), // Link organization names
      data: { name: 'Organizations' },
      canRename: false,
    },
    ...orgs.reduce((acc, org) => ({ ...acc, ...createOrganization(org) }), {}),
  },
};

export default function NavTree() {
  return (
    <UncontrolledTreeEnvironment
      dataProvider={
        new StaticTreeDataProvider(navTree.items, (item) => ({
          ...item,
          data: item.data,
        }))
      }
      getItemTitle={(item) => item.data.name}
      viewState={{}}
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
              className="flex h-8 w-full flex-row justify-start px-2 py-1"
            >
              <span
                className={cn(context.isFocused ? 'text-primary-main' : '')}
              >
                {item.data.isProjectPage && item.data.icon}
              </span>
              <span
                className={cn(
                  'pl-2',
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
                    'ml-2 h-5 px-[6px] text-[10px]',
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
    >
      <Tree treeId="tree-1" rootItem="root" treeLabel="Tree Example" />
    </UncontrolledTreeEnvironment>
  );
}
