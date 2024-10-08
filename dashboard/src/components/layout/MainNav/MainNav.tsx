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
import NavTree from './NavTree';
import WorkspacesNavTree from './WorkspacesNavTree';

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

        <Separator />

        <div className="h-[calc(100vh-6rem)] space-y-4 overflow-auto px-4 pb-12 pt-2">
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
