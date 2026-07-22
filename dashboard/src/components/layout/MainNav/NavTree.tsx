import { ChevronDown, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  ControlledTreeEnvironment,
  Tree,
  type TreeItemIndex,
} from 'react-complex-tree';
import { buildNavTreeData } from '@/components/layout/MainNav/nav-config';
import { useTreeNavState } from '@/components/layout/MainNav/TreeNavStateContext';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { cn, isNotEmptyValue } from '@/lib/utils';

export default function NavTree() {
  const { currentOrg: org } = useOrgs();

  const navTree = buildNavTreeData(org);

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
                // this will prevent the case where clicking on the project name
                // would focus on the project name instead of the overview page
                if (
                  navTree.items[item.index].data.targetUrl ===
                  item.data.targetUrl
                ) {
                  return;
                }

                if (
                  ['GraphQL', 'Events', 'Auth', 'Database'].includes(
                    item.data.name,
                  ) &&
                  item.isFolder
                ) {
                  if (!context.isExpanded) {
                    context.toggleExpandedState();
                  }
                }

                if (item.data.type !== 'org') {
                  context.focusItem();
                }
              }}
              className={cn(
                'flex h-8 w-full flex-row justify-start gap-1 bg-background px-1 text-foreground hover:bg-accent',
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
          ({ expandedItems: prevExpandedItems, ...rest }) => {
            const newExpandedItems = isNotEmptyValue(prevExpandedItems)
              ? [...prevExpandedItems]
              : [];

            return {
              ...rest,
              // Add item index to expandedItems only if it's not already present
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
            // Remove the item index from expandedItems
            expandedItems: (prevExpandedItems ?? []).filter(
              (index: TreeItemIndex) => index !== item.index,
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
