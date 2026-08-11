import { Menu, X } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef } from 'react';

import NavTree from '@/components/layout/MainNav/NavTree';
import { useTreeNavState } from '@/components/layout/MainNav/TreeNavStateContext';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { CommandPaletteTrigger } from '@/features/command-palette';

interface MainNavProps {
  container: HTMLElement | null;
}

export default function MainNav({ container }: MainNavProps) {
  const { asPath } = useRouter();
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const { open, setOpen } = useTreeNavState();

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
    <Sheet open={open} onOpenChange={setOpen}>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: hover opens the sheet */}
      <div
        className="absolute left-0 z-[39] flex h-full w-6 justify-center border-r bg-background pt-1 hover:bg-accent"
        onMouseEnter={() => setOpen(true)}
      >
        <Menu className="h-4 w-4" />
      </div>

      <SheetContent
        side="left"
        container={container}
        hideCloseButton
        className="absolute inset-y-0 flex h-full w-full flex-col gap-0 p-0 sm:max-w-[272px]"
        onMouseLeave={() => setOpen(false)}
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex h-12 w-full shrink-0 items-center gap-1 bg-background px-2 py-1">
          <CommandPaletteTrigger
            className="h-8 min-w-0 flex-1 px-1"
            onClick={() => setOpen(false)}
          />
          <Button variant="ghost" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <div
          ref={scrollContainerRef}
          className="min-h-0 flex-1 overflow-auto py-1"
        >
          <div className="flex flex-col gap-1 px-4">
            <NavTree />
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
