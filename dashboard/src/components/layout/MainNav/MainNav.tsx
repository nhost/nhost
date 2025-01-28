import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useWorkspaces } from '@/features/orgs/projects/hooks/useWorkspaces';
import { Menu, Pin, PinOff, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import NavTree from './NavTree';
import { useTreeNavState } from './TreeNavStateContext';
import WorkspacesNavTree from './WorkspacesNavTree';

interface MainNavProps {
  container: HTMLElement;
}

export default function MainNav({ container }: MainNavProps) {
  const { asPath } = useRouter();
  const { workspaces } = useWorkspaces();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { open, setOpen, mainNavPinned, setMainNavPinned } = useTreeNavState();

  const scrollToCurrentPath = () => {
    requestAnimationFrame(() => {
      const element = document.querySelector(`a[href="${asPath}"]`);
      if (element && scrollContainerRef.current) {
        element.scrollIntoView({ block: 'center' });
      }
    });
  };

  useEffect(() => {
    if (open) {
      scrollToCurrentPath();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <div
        className="min- absolute left-0 z-50 flex h-full w-6 justify-center border-r-[1px] bg-background pt-1 hover:bg-accent"
        onMouseEnter={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </div>

      <SheetContent
        side="left"
        container={container}
        hideCloseButton
        className="h-full w-full p-0 sm:max-w-[310px]"
        onMouseLeave={() => setOpen(false)}
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-12 w-full flex-row items-center justify-end border-b bg-background px-1">
          <Button
            variant="ghost"
            className="hidden sm:flex"
            onClick={() => setMainNavPinned(!mainNavPinned)}
          >
            {mainNavPinned ? (
              <PinOff className="h-5 w-5" />
            ) : (
              <Pin className="h-5 w-5" />
            )}
          </Button>

          <Button
            variant="ghost"
            className="flex sm:hidden"
            onClick={() => setOpen(false)}
          >
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          className="h-[calc(100vh-7rem)] space-y-4 overflow-auto pb-12 pt-2 lg:h-[calc(100vh-6rem)]"
        >
          <div className="flex flex-col gap-1 px-2">
            <NavTree />
            <CreateOrgDialog />
          </div>
          {workspaces.length > 0 && (
            <>
              <Separator className="mx-auto my-2" />
              <div className="px-2">
                <WorkspacesNavTree />
              </div>
            </>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
