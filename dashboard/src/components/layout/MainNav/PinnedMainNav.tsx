import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import NavTree from '@/components/layout/MainNav/NavTree';
import SidebarPinButton from '@/components/layout/MainNav/SidebarPinButton';
import { CommandPaletteTrigger } from '@/features/command-palette';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useTreeNavState } from './TreeNavStateContext';

export default function PinnedMainNav() {
  const { asPath } = useRouter();

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    mainNavPinned,
    setMainNavPinned,
    setOpen,
    setMainNavOpenAnimationSuppressed,
  } = useTreeNavState();

  const handleUnpin = () => {
    setMainNavOpenAnimationSuppressed(true);
    setOpen(true);
    setMainNavPinned(false);
  };

  useEffect(() => {
    let observer: MutationObserver;

    const scrollToElement = () => {
      const element = document.querySelector(`a[href="${asPath}"]`);
      if (element) {
        element.scrollIntoView({ block: 'center' });
        observer.disconnect(); // Stop observing once the element is found and scrolled to
      }
    };

    if (scrollContainerRef.current) {
      observer = new MutationObserver(scrollToElement);

      // Start observing the tree container for child additions or subtree changes
      observer.observe(scrollContainerRef.current, {
        childList: true,
        subtree: true,
        // run scrollToElement when the class changes because of focus
        attributeFilter: ['class'],
      });
    }

    // Clean up the observer when the component unmounts or the effect re-runs
    return () => {
      if (observer) {
        observer.disconnect();
      }
    };
  }, [asPath]);

  return (
    <div className="flex h-full w-full flex-shrink-0 flex-col border-r p-0 sm:max-w-[310px]">
      <div className="flex h-12 w-full shrink-0 items-center bg-background p-1 px-2">
        <CommandPaletteTrigger className="h-8 min-w-0 flex-1 px-[4px]" />
      </div>

      <div
        ref={scrollContainerRef}
        className="min-h-0 flex-1 overflow-auto py-1"
      >
        <div className="flex flex-col gap-1 px-2">
          <NavTree />
          <CreateOrgDialog />
        </div>
      </div>

      <div className="flex h-10 shrink-0 items-center justify-end border-t px-2">
        <SidebarPinButton pinned={mainNavPinned} onClick={handleUnpin} />
      </div>
    </div>
  );
}
