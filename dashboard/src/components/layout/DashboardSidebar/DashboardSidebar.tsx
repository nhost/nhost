import { ChevronLeft, ChevronRight } from 'lucide-react';
import Link from 'next/link';
import {
  type ComponentPropsWithoutRef,
  createContext,
  type ReactElement,
  type ReactNode,
  useContext,
  useId,
} from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

interface DashboardSidebarContextValue {
  collapsed: boolean;
}

export interface DashboardSidebarProps
  extends Omit<ComponentPropsWithoutRef<'aside'>, 'aria-label'> {
  ariaLabel: string;
  children: ReactNode;
  footer?: ReactNode;
  storageKey?: string;
}

export interface DashboardSidebarItemProps {
  label: string;
  href: string;
  icon: ReactElement;
  active?: boolean;
  disabled?: boolean;
}

export interface DashboardSidebarSectionProps
  extends ComponentPropsWithoutRef<'section'> {
  label?: string;
  children: ReactNode;
}

const DEFAULT_STORAGE_KEY = 'dashboard-sidebar-collapsed';
const EXPANDED_WIDTH_CLASS = 'w-[200px]';
const COLLAPSED_WIDTH_CLASS = 'w-[72px]';

const DashboardSidebarContext =
  createContext<DashboardSidebarContextValue | null>(null);

const useDashboardSidebarContext = () => {
  const context = useContext(DashboardSidebarContext);

  if (!context) {
    throw new Error(
      'DashboardSidebar compound components must be rendered inside DashboardSidebar',
    );
  }

  return context;
};

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

export const dashboardNavItemTextClassName =
  'font-normal text-neutral-600 text-sm transition-colors hover:bg-neutral-50 hover:text-neutral-900 dark:text-[#C2C4C7] dark:hover:bg-[#1E2124] dark:hover:text-[#E8E9EB]';

export const dashboardNavItemIconClassName = 'text-[#636363] dark:text-[#B0B3B6]';

function DashboardSidebarItem({
  label,
  href,
  icon,
  active,
  disabled,
}: DashboardSidebarItemProps) {
  const { collapsed } = useDashboardSidebarContext();
  const itemClassName = cn(
    'flex w-full items-center rounded-md',
    dashboardNavItemTextClassName,
    collapsed ? 'justify-center px-2 py-2' : 'justify-start gap-2.5 px-2 py-1.5',
    active &&
      'bg-neutral-100 font-medium text-primary hover:bg-neutral-100 hover:text-primary dark:bg-[#313438] dark:text-primary dark:hover:bg-[#313438] dark:hover:text-primary',
    disabled &&
      'cursor-not-allowed opacity-50 hover:bg-transparent hover:text-neutral-600 dark:hover:bg-transparent dark:hover:text-[#C2C4C7]',
  );
  const iconClassName = cn(
    'flex size-4 shrink-0 items-center justify-center',
    active ? 'text-primary' : dashboardNavItemIconClassName,
  );
  const content = (
    <>
      <span aria-hidden="true" className={iconClassName}>
        {icon}
      </span>
      <span className={cn('flex-1 truncate text-left', collapsed && 'sr-only')}>
        {label}
      </span>
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

function DashboardSidebarSection({
  label,
  children,
  id,
  ...props
}: DashboardSidebarSectionProps) {
  const { collapsed } = useDashboardSidebarContext();
  const generatedLabelId = useId();
  const labelId = label ? (id ? `${id}-heading` : generatedLabelId) : undefined;

  return (
    <section
      id={id}
      aria-labelledby={labelId}
      className="mt-6 first:mt-0"
      {...props}
    >
      {label && !collapsed && (
        <h2
          id={labelId}
          className="px-2 mb-1 text-[10px] font-normal uppercase tracking-[0.08em] text-neutral-500 dark:text-[#B0B3B6]"
        >
          {label}
        </h2>
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

function DashboardSidebar({
  ariaLabel,
  children,
  footer,
  storageKey = DEFAULT_STORAGE_KEY,
  className,
  ...props
}: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useSSRLocalStorage(storageKey, false);
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <DashboardSidebarContext.Provider value={{ collapsed }}>
      <aside
        aria-label={ariaLabel}
        className={cn(
          'sticky top-14 flex h-[calc(100vh-3.5rem)] shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out',
          collapsed ? COLLAPSED_WIDTH_CLASS : EXPANDED_WIDTH_CLASS,
          className,
        )}
        {...props}
      >
        <nav
          aria-label={ariaLabel}
          className="min-h-0 flex-1 overflow-y-auto p-2"
        >
          <div className="flex flex-col gap-1">{children}</div>
        </nav>

        {footer && (
          <div className="shrink-0 border-t p-2">
            <ul className="flex flex-col gap-1">{footer}</ul>
          </div>
        )}

        <div className="flex h-16 shrink-0 items-center justify-center border-t px-2">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={toggleLabel}
            aria-pressed={collapsed}
            className="size-10 text-muted-foreground"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? (
              <ChevronRight className="size-4" />
            ) : (
              <ChevronLeft className="size-4" />
            )}
          </Button>
        </div>
      </aside>
    </DashboardSidebarContext.Provider>
  );
}

DashboardSidebar.Item = DashboardSidebarItem;
DashboardSidebar.Section = DashboardSidebarSection;

export default DashboardSidebar;
