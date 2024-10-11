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
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';
import { PanelLeft, Pin, PinOff } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import NavTree from './NavTree';
import WorkspacesNavTree from './WorkspacesNavTree';

interface MainNavProps {
  container: HTMLElement;
}

export default function MainNav({ container }: MainNavProps) {
  const { asPath } = useRouter();
  const [open, setOpen] = useState(false);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage(
    'nav-tree-pin',
    false,
  );

  const scrollToCurrentPath = () => {
    requestAnimationFrame(() => {
      const element = document.querySelector(`a[href="${asPath}"]`);
      if (element && scrollContainerRef.current) {
        element.scrollIntoView({ block: 'center', behavior: 'smooth' });
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
          <PanelLeft className="w-6 h-6" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        container={container}
        hideCloseButton
        className="w-full h-full p-0 sm:max-w-72"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex items-center justify-end w-full h-12 border-b bg-background">
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
          className="h-[calc(100vh-6rem)] space-y-4 overflow-auto px-4 pb-12 pt-2"
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
      </SheetContent>
    </Sheet>
  );
}
