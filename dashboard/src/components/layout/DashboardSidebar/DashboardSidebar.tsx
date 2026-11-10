import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { ComponentPropsWithoutRef, ReactNode } from 'react';
import { NavigationListContext } from '@/components/layout/NavigationList';
import { Button } from '@/components/ui/v3/button';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';

interface DashboardSidebarProps extends ComponentPropsWithoutRef<'aside'> {
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
          'flex h-full shrink-0 flex-col overflow-hidden border-r transition-[width] duration-300 ease-in-out motion-reduce:transition-none',
          collapsed ? COLLAPSED_WIDTH_CLASS : EXPANDED_WIDTH_CLASS,
          className,
        )}
        {...props}
      >
        {children}

        {/* The padding keeps the 28px toggle on the same axis as the nav
            icons, and animates with them to the center when collapsed. */}
        <div
          className={cn(
            'flex shrink-0 items-center pt-1 pb-3 transition-[padding] duration-300 ease-in-out motion-reduce:transition-none',
            collapsed ? 'pl-[22px]' : 'pl-2.5',
          )}
        >
          <Button
            type="button"
            variant="subtle"
            aria-label={toggleLabel}
            aria-pressed={collapsed}
            className="h-7 w-7"
            onClick={() => setCollapsed(!collapsed)}
          >
            {collapsed ? <ChevronRight /> : <ChevronLeft />}
          </Button>
        </div>
      </aside>
    </NavigationListContext.Provider>
  );
}
