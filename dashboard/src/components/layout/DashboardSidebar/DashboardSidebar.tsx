import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { NavigationListContext } from '@/components/layout/NavigationList';
import { Button } from '@/components/ui/v3/button';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

export interface DashboardSidebarProps
  extends ComponentPropsWithoutRef<'aside'> {
  children: ReactNode;
  storageKey?: string;
}

const DEFAULT_STORAGE_KEY = 'dashboard-sidebar-collapsed';
const EXPANDED_WIDTH_CLASS = 'w-[200px]';
const COLLAPSED_WIDTH_CLASS = 'w-[72px]';

/**
 * The docked, collapsible shell around a `NavigationList`. It owns the collapsed
 * state and hands it to the nav through context.
 */
export default function DashboardSidebar({
  children,
  storageKey = DEFAULT_STORAGE_KEY,
  className,
  ...props
}: DashboardSidebarProps) {
  const [collapsed, setCollapsed] = useSSRLocalStorage(storageKey, false);
  const toggleLabel = collapsed ? 'Expand sidebar' : 'Collapse sidebar';

  return (
    <NavigationListContext.Provider value={{ collapsed }}>
      <aside
        className={cn(
          'flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200 ease-in-out',
          collapsed ? COLLAPSED_WIDTH_CLASS : EXPANDED_WIDTH_CLASS,
          className,
        )}
        {...props}
      >
        {children}

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
    </NavigationListContext.Provider>
  );
}
