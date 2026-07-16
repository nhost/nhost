import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';
import SidebarPinButton from '@/components/layout/MainNav/SidebarPinButton';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { CommandPaletteTrigger } from '@/features/command-palette';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { cn } from '@/lib/utils';
import NavTree from './NavTree';
import { useTreeNavState } from './TreeNavStateContext';

interface MainNavProps {
  container: HTMLElement | null;
}

export default function MainNav({ container }: MainNavProps) {
  const { asPath } = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const {
    open,
    setOpen,
    mainNavPinned,
    setMainNavPinned,
    mainNavOpenAnimationSuppressed,
    setMainNavOpenAnimationSuppressed,
  } = useTreeNavState();

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      setMainNavOpenAnimationSuppressed(false);
    }
  };

  useEffect(() => {
    if (open) {
      const scrollToCurrentPath = () => {
        requestAnimationFrame(() => {
          const element = document.querySelector(`a[href="${asPath}"]`);
          if (element && scrollContainerRef.current) {
            element.scrollIntoView({ block: 'center' });
          }
        });
      };
      scrollToCurrentPath();
    }
  }, [open, asPath]);

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: hover opens the sheet */}
      <div
        className="min- absolute left-0 z-[39] flex h-full w-6 justify-center border-r-[1px] bg-background pt-1 hover:bg-accent"
        onMouseEnter={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </div>

      <SheetContent
        side="left"
        container={container}
        hideCloseButton
        className={cn(
          'absolute inset-y-0 flex h-full w-full flex-col gap-0 p-0 sm:max-w-[310px]',
          mainNavOpenAnimationSuppressed &&
            'data-[state=open]:animate-none data-[state=open]:duration-0',
        )}
        onMouseLeave={() => handleOpenChange(false)}
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-12 w-full shrink-0 items-center gap-1 bg-background p-1 px-2">
          <CommandPaletteTrigger
            className="h-8 min-w-0 flex-1 px-[4px]"
            onClick={() => handleOpenChange(false)}
          />
          <Button
            variant="ghost"
            className="flex sm:hidden"
            onClick={() => handleOpenChange(false)}
          >
            <X className="h-5 w-5" />
          </Button>
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

        <div className="hidden h-10 shrink-0 items-center justify-end border-t px-2 sm:flex">
          <SidebarPinButton
            pinned={mainNavPinned}
            onClick={() => setMainNavPinned(!mainNavPinned)}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
