import Link from 'next/link';
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
} from 'react';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { cn } from '@/lib/utils';

export interface NavigationListContextValue {
  collapsed: boolean;
}

/**
 * Provided by a collapsible shell such as `DashboardSidebar`. Anywhere else
 * the nav renders expanded.
 */
export const NavigationListContext = createContext<NavigationListContextValue>({
  collapsed: false,
});

export interface NavigationListProps {
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  className?: string;
}

export interface NavigationListItemProps {
  label: string;
  href: string;
  icon: ReactElement;
  active?: boolean;
  disabled?: boolean;
}

export interface NavigationListSectionProps
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
  active,
  disabled,
}: NavigationListItemProps) {
  const { collapsed } = useContext(NavigationListContext);
  const itemClassName = cn(
    'flex h-10 w-full items-center rounded-lg font-medium text-muted-foreground text-sm transition-colors hover:bg-accent hover:text-accent-foreground',
    collapsed ? 'justify-center px-0' : 'justify-start gap-3 px-3',
    active &&
      'bg-[#ebf3ff] text-primary hover:bg-[#ebf3ff] dark:bg-muted dark:hover:bg-muted',
    disabled &&
      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-muted-foreground',
  );
  const content = (
    <>
      <span
        aria-hidden="true"
        className="flex size-5 shrink-0 items-center justify-center"
      >
        {icon}
      </span>
      <span className={cn('truncate', collapsed && 'sr-only')}>{label}</span>
    </>
  );

  const navItem = disabled ? (
    <div
      aria-current={active ? 'page' : undefined}
      aria-disabled="true"
      className={itemClassName}
    >
      {content}
    </div>
  ) : (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={itemClassName}
    >
      {content}
    </Link>
  );

  return (
    <li>
      <SidebarTooltip collapsed={collapsed} label={label}>
        {navItem}
      </SidebarTooltip>
    </li>
  );
}

function NavigationListSection({
  label,
  children,
  id,
  ...props
}: NavigationListSectionProps) {
  const { collapsed } = useContext(NavigationListContext);
  const generatedLabelId = useId();
  const labelId = label ? (id ? `${id}-heading` : generatedLabelId) : undefined;

  return (
    <section id={id} aria-labelledby={labelId} {...props}>
      {label && !collapsed && (
        <h2
          id={labelId}
          className="px-3 pt-5 pb-2 font-semibold text-2xs text-muted-foreground uppercase tracking-[0.16em]"
        >
          {label}
        </h2>
      )}
      {label && collapsed && (
        <h2 id={labelId} className="sr-only">
          {label}
        </h2>
      )}
      <ul className="flex flex-col gap-1">{children}</ul>
    </section>
  );
}

function NavigationList({
  ariaLabel,
  children,
  footer,
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

      {footer && (
        <div className="shrink-0 border-t p-2">
          <ul className="flex flex-col gap-1">{footer}</ul>
        </div>
      )}
    </nav>
  );
}

NavigationList.Item = NavigationListItem;
NavigationList.Section = NavigationListSection;

export default NavigationList;
