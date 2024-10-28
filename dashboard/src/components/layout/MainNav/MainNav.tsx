import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { cn } from '@/lib/utils';
import { PanelLeft, Pin, PinOff } from 'lucide-react';
import NavTree from './NavTree';

interface MainNavProps {
  container: HTMLElement;
}

export default function MainNav({ container }: MainNavProps) {
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage(
    'nav-tree-pin',
    false,
  );

  return (
    <Sheet>
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
        className="h-full w-full p-0 sm:max-w-72"
      >
        <SheetHeader>
          <SheetTitle className="sr-only">Main navigation</SheetTitle>
          <SheetDescription className="sr-only">
            Nhost Dashboard Main Navigation
          </SheetDescription>
        </SheetHeader>

        <div className="flex w-full justify-end bg-background p-1">
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

        <div className="h-[calc(100vh-6rem)] overflow-auto px-4 pb-12 pt-2">
          <NavTree />
        </div>
      </SheetContent>
    </Sheet>
  );
}
