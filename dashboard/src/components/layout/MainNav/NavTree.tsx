import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItem,
  type TreeItemIndex,
} from 'react-complex-tree';
import {
  isPageGated,
  projectAuthPages,
  projectEventsPages,
  projectGraphQLPages,
  projectPages,
  projectSettingsPages,
} from '@/components/layout/MainNav/nav-config';
import { useTreeNavState } from '@/components/layout/MainNav/TreeNavStateContext';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { getConfigServerUrl, isPlatform as getIsPlatform } from '@/utils/env';

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
  isNotPlatform: boolean;
};

const FOLDER_PAGES = new Set(['settings', 'graphql', 'events', 'auth']);

const buildProjectTree = ({
  orgSlug,
  appSubdomain,
  shouldDisableSettings,
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
        disabled: isPageGated(page.gate, {
          isNotPlatform,
          shouldDisableSettings,
        }),
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

interface NavTreeProps {
  expanded?: boolean;
}

export default function NavTree({ expanded = true }: NavTreeProps) {
  const router = useRouter();

  const orgSlug = router.query.orgSlug as string | undefined;
  const appSubdomain = router.query.appSubdomain as string | undefined;

  const isNotPlatform = !getIsPlatform();
  const configServerVariableNotSet = getConfigServerUrl() === '';
  const shouldDisableSettings = isNotPlatform && configServerVariableNotSet;

  const navTree =
    orgSlug && appSubdomain
      ? buildProjectTree({
          orgSlug,
          appSubdomain,
          shouldDisableSettings,
          isNotPlatform,
        })
      : emptyTree;

  const { orgsTreeViewState, setOrgsTreeViewState, setOpen } =
    useTreeNavState();

  const focusedItem = orgsTreeViewState.focusedItem?.toString();

  return (
    <div className={cn('flex flex-col gap-2', !expanded && 'items-center')}>
      <ControlledTreeEnvironment
        items={navTree.items}
        getItemTitle={(item) => item.data.name}
        viewState={{
          'nav-tree': expanded
            ? orgsTreeViewState
            : { ...orgsTreeViewState, expandedItems: [] },
        }}
        renderItemTitle={({ title }) => <span>{title}</span>}
        renderItemArrow={({ item, context }) => {
          if (!expanded || !item.isFolder) {
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
        renderItem={({ arrow, context, item, children }) => {
          const itemIndex = item.index.toString();
          const isActive =
            context.isFocused ||
            (item.isFolder && focusedItem?.startsWith(`${itemIndex}-`));
          const itemButton = (
            <Button
              asChild
              onClick={() => {
                if (
                  expanded &&
                  item.isFolder &&
                  FOLDER_PAGES.has(itemIndex) &&
                  !context.isExpanded
                ) {
                  context.toggleExpandedState();
                }

                context.focusItem();
              }}
              className={cn(
                'flex text-foreground hover:bg-accent',
                expanded
                  ? 'h-8 min-w-0 flex-1 flex-row justify-start gap-2 bg-background px-2'
                  : 'h-9 w-9 justify-center bg-transparent p-0',
                isActive &&
                  'bg-[#ebf3ff] text-primary hover:bg-accent dark:bg-muted',
                item.data.disabled && 'pointer-events-none opacity-50',
              )}
            >
              <Link
                href={item.data.targetUrl || '/'}
                shallow
                onClick={() => setOpen(false)}
              >
                {item.data.icon && (
                  <span className="flex shrink-0 items-center">
                    {item.data.icon}
                  </span>
                )}
                <span
                  className={cn(
                    'max-w-52 truncate',
                    isActive && 'font-bold',
                    !expanded && 'sr-only',
                  )}
                >
                  {item.data.name}
                </span>
              </Link>
            </Button>
          );

          return (
            <li
              {...context.itemContainerWithChildrenProps}
              className="flex flex-col gap-1"
            >
              <div className="flex flex-row items-center">
                {expanded && arrow}
                {expanded ? (
                  itemButton
                ) : (
                  <Tooltip>
                    <TooltipTrigger asChild>{itemButton}</TooltipTrigger>
                    <TooltipContent side="right" sideOffset={8}>
                      {item.data.name}
                    </TooltipContent>
                  </Tooltip>
                )}
              </div>
              {expanded && <div>{children}</div>}
            </li>
          );
        }}
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
