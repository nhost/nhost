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
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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
    <div className="w-full h-full p-0 border-r sm:max-w-96">
      <div className="flex justify-end w-full h-12 p-1 border-b bg-background">
        <Button
          variant="ghost"
          onClick={() => setMainNavPinned(!mainNavPinned)}
        >
          {mainNavPinned ? (
            <PinOff className="w-5 h-5" />
          ) : (
            <Pin className="w-5 h-5" />
          )}
        </Button>
      </div>

      <div
        ref={scrollContainerRef}
        className="h-[calc(100vh-6rem)] overflow-auto pb-12 pt-2"
      >
        <div className="px-4">
          <NavTree />
          <CreateOrgDialog />
        </div>
        <Separator className="mx-auto my-2" />
        <div className="px-4">
          <WorkspacesNavTree />
        </div>
      </div>
    </div>
  );
}
