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

function DashboardSidebarItem({
  label,
  href,
  icon,
  active,
  disabled,
}: DashboardSidebarItemProps) {
  const { collapsed } = useDashboardSidebarContext();
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
    <section id={id} aria-labelledby={labelId} {...props}>
      {label && !collapsed && (
        <h2
          id={labelId}
          className="px-3 pt-5 pb-2 font-semibold text-muted-foreground text-xs uppercase tracking-[0.16em]"
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
          'flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out',
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
