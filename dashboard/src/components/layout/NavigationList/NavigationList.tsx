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
  if (!collapsed) {
    return children;
  }

  return (
    <Tooltip>
      <TooltipTrigger asChild>{children}</TooltipTrigger>
      <TooltipContent side="right" sideOffset={8}>
        {label}
      </TooltipContent>
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
          className={cn(collapsed && 'justify-center py-2')}
        >
          <span
            aria-hidden="true"
            className="flex size-4 shrink-0 items-center justify-center"
          >
            {icon}
          </span>
          <span className={cn('truncate', collapsed && 'sr-only')}>
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
      {label && !collapsed && (
        <SidebarSectionTitle id={labelId}>{label}</SidebarSectionTitle>
      )}
      {label && collapsed && (
        <h2 id={labelId} className="sr-only">
          {label}
        </h2>
      )}
      <ul className={cn('flex flex-col', collapsed && 'gap-1')}>{children}</ul>
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
      <div className="min-h-0 flex-1 overflow-y-auto p-2">
        <div className="flex flex-col gap-1">{children}</div>
      </div>
    </nav>
  );
}

NavigationList.Item = NavigationListItem;
NavigationList.Section = NavigationListSection;

export default NavigationList;
