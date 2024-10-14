import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { cn } from '@/lib/utils';
import { PanelLeft, Pin, PinOff } from 'lucide-react';
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
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          className={cn('px-3 py-1', mainNavPinned && 'hidden')}
          disabled={mainNavPinned}
        >
          <PanelLeft className="h-6 w-6" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        container={container}
        hideCloseButton
        className="h-full w-full p-0 sm:max-w-[310px]"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-12 w-full items-center justify-end border-b bg-background px-1">
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
          className="h-[calc(100vh-6rem)] space-y-4 overflow-auto pb-12 pt-2"
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
      </SheetContent>
    </Sheet>
  );
}
