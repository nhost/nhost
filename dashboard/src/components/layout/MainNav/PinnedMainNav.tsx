import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

import NavTree from '@/components/layout/MainNav/NavTree';
import SidebarCollapseButton from '@/components/layout/MainNav/SidebarCollapseButton';
import { useTreeNavState } from '@/components/layout/MainNav/TreeNavStateContext';
import { CommandPaletteTrigger } from '@/features/command-palette';
import { cn } from '@/lib/utils';

export default function PinnedMainNav() {
  const { asPath } = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { mainNavExpanded, setMainNavExpanded } = useTreeNavState();

  useEffect(() => {
    let observer: MutationObserver;

    const scrollToElement = () => {
      const element = document.querySelector(`a[href="${asPath}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center' });
        observer.disconnect();
      }
    };

    if (scrollContainerRef.current) {
      observer = new MutationObserver(scrollToElement);

      observer.observe(scrollContainerRef.current, {
        childList: true,
        subtree: true,
        attributeFilter: ['class'],
      });
    }

    return () => {
      observer?.disconnect();
    };
  }, [asPath]);

  return (
    <aside
      aria-label="Project navigation"
      className={cn(
        'flex h-full shrink-0 flex-col border-r bg-background transition-[width] duration-200',
        mainNavExpanded ? 'w-[272px]' : 'w-12',
      )}
    >
      <div
        className={cn(
          'flex h-12 w-full shrink-0 items-center py-1',
          mainNavExpanded ? 'px-2' : 'justify-center px-1',
        )}
      >
        <CommandPaletteTrigger
          variant={mainNavExpanded ? 'box' : 'icon'}
          className={cn('h-8', mainNavExpanded ? 'min-w-0 flex-1 px-1' : 'w-8')}
        />
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden py-1"
      >
        <div
          className={cn(
            'flex flex-col gap-1',
            mainNavExpanded ? 'px-4' : 'px-1',
          )}
        >
          <NavTree expanded={mainNavExpanded} />
        </div>
      </div>

      <SidebarCollapseButton
        expanded={mainNavExpanded}
        onClick={() => setMainNavExpanded(!mainNavExpanded)}
      />
    </aside>
  );
}
