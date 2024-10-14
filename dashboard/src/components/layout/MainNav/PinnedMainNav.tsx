import NavTree from '@/components/layout/MainNav/NavTree';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { Pin, PinOff } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import { useTreeNavState } from './TreeNavStateContext';
import WorkspacesNavTree from './WorkspacesNavTree';

export default function PinnedMainNav() {
  const { asPath } = useRouter();
  const scrollContainerRef = useRef();

  const { mainNavPinned, setMainNavPinned } = useTreeNavState();

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
    <div className="h-full w-full border-r p-0 sm:max-w-[310px]">
      <div className="flex h-12 w-full justify-end border-b bg-background p-1">
        <Button
          variant="ghost"
          onClick={() => setMainNavPinned(!mainNavPinned)}
        >
          {mainNavPinned ? (
            <PinOff className="h-5 w-5" />
          ) : (
            <Pin className="h-5 w-5" />
          )}
        </Button>
      </div>

      <div
        ref={scrollContainerRef}
        className="h-[calc(100vh-6rem)] overflow-auto pb-12 pt-2"
      >
        <div className="pl-2">
          <NavTree />
          <CreateOrgDialog />
        </div>
        <Separator className="mx-auto my-2" />
        <div className="pl-2">
          <WorkspacesNavTree />
        </div>
      </div>
    </div>
  );
}
