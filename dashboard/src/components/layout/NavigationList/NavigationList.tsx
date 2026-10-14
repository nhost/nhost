import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
} from 'react';
import { SidebarItem, SidebarSectionTitle } from '@/components/layout/Sidebar';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

interface NavigationListContextValue {
  collapsed: boolean;
}

/**
 * Provided by a collapsible shell such as `DashboardSidebar`. Anywhere else
 * the nav renders expanded.
 */
export const NavigationListContext = createContext<NavigationListContextValue>({
  collapsed: false,
});

interface NavigationListProps {
  ariaLabel: string;
  children: ReactNode;
  className?: string;
}

interface NavigationListItemProps {
  label: string;
  href: string;
  icon: ReactElement;
  /**
   * The path whose pages mark the item active, for items that link deeper
   * than the section they stand for. Defaults to `href`.
   */
  activePath?: string;
  /** Only the path itself marks the item active, not the pages below it. */
  exact?: boolean;
  disabled?: boolean;
}

interface NavigationListSectionProps
  extends ComponentPropsWithoutRef<'section'> {
  label?: string;
  children: ReactNode;
}

function SidebarTooltip({
  collapsed,
  label,
  children,
}: {
  collapsed: boolean;
  label: string;
  children: ReactNode;
}) {
  // Always render the tooltip wrapper and only toggle its content. Swapping
  // the wrapper in and out would remount the item, and its collapse
  // transitions would never run. `disableHoverableContent` makes leaving the
  // item close the tooltip by itself; otherwise the (unrendered) content is in
  // charge of closing it, and an item hovered while expanded would show its
  // tooltip as soon as the sidebar collapses.
  return (
    <Tooltip disableHoverableContent>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      {collapsed && (
        <TooltipContent side="right" sideOffset={8}>
          {label}
        </TooltipContent>
      )}
    </Tooltip>
  );
}

function NavigationListItem({
  label,
  href,
  icon,
  activePath,
  exact = false,
  disabled,
}: NavigationListItemProps) {
  const { collapsed } = useContext(NavigationListContext);

  return (
    <li>
      <SidebarTooltip collapsed={collapsed} label={label}>
        <SidebarItem
          href={href}
          activePath={activePath}
          exact={exact}
          disabled={disabled}
          className={cn(
            'transition-[color,background-color,padding] ease-in-out [transition-duration:150ms,150ms,300ms] motion-reduce:transition-none',
            collapsed && 'pl-5',
          )}
        >
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center"
          >
            {icon}
          </span>
          <span
            className={cn(
              'overflow-hidden whitespace-nowrap transition-opacity motion-reduce:transition-none',
              collapsed
                ? 'text-clip opacity-0 duration-300 ease-in-out'
                : 'text-ellipsis opacity-100 delay-100 duration-300',
            )}
          >
            {label}
          </span>
        </SidebarItem>
      </SidebarTooltip>
    </li>
  );
}

function NavigationListSection({
  label,
  children,
  id,
  className,
  ...props
}: NavigationListSectionProps) {
  const { collapsed } = useContext(NavigationListContext);
  const generatedLabelId = useId();
  const labelId = label ? (id ? `${id}-heading` : generatedLabelId) : undefined;

  return (
    <section
      id={id}
      aria-labelledby={labelId}
      className={cn('mt-[1.2rem] first:mt-0', className)}
      {...props}
    >
      {label && (
        // Collapses its height with the grid-rows trick instead of unmounting,
        // so the items below glide up rather than jump.
        <div
          className={cn(
            'grid transition-[grid-template-rows,opacity] duration-300 ease-in-out motion-reduce:transition-none',
            collapsed ? 'grid-rows-[0fr] opacity-0' : 'grid-rows-[1fr]',
          )}
        >
          <div className="min-h-0 overflow-hidden">
            <SidebarSectionTitle id={labelId} className="whitespace-nowrap">
              {label}
            </SidebarSectionTitle>
          </div>
        </div>
      )}
      <ul className="flex flex-col">{children}</ul>
    </section>
  );
}

function NavigationList({
  ariaLabel,
  children,
  className,
}: NavigationListProps) {
  return (
    <nav
      aria-label={ariaLabel}
      className={cn('flex min-h-0 flex-1 flex-col', className)}
    >
      <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden p-2">
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </nav>
  );
}

NavigationList.Item = NavigationListItem;
NavigationList.Section = NavigationListSection;

export default NavigationList;
