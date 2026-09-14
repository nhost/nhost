import { MenuIcon, XIcon } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';
import DashboardNavigation from '@/components/layout/DashboardNavigation/DashboardNavigation';
import { useCurrentRoute } from '@/components/layout/DashboardNavigation/useCurrentRoute';
import { Button } from '@/components/ui/v3/button';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/v3/sheet';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';

export default function DashboardNavigationSheet() {
  const [open, setOpen] = useState(false);
  const { events } = useRouter();
  const { isProjectRoute } = useCurrentRoute();
  const { currentOrg } = useOrgs();
  const { project } = useProject();
  const title =
    (isProjectRoute ? project?.name : currentOrg?.name) ?? 'Navigation';

  // The shell stays mounted across navigation, so a picked link would leave
  // the sheet open otherwise.
  useEffect(() => {
    const close = () => setOpen(false);

    events.on('routeChangeStart', close);

    return () => events.off('routeChangeStart', close);
  }, [events]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          className="shrink-0"
        >
          <MenuIcon className="size-5" />
        </Button>
      </SheetTrigger>

      <SheetContent
        side="left"
        showOverlay
        hideCloseButton
        className="flex flex-col gap-0 p-0"
      >
        <div className="flex h-14 shrink-0 items-center justify-between gap-2 border-b px-4">
          <SheetTitle className="truncate text-base">{title}</SheetTitle>
          <SheetClose asChild>
            <Button
              variant="ghost"
              size="icon"
              aria-label="Close navigation"
              className="h-8 w-8 shrink-0 text-muted-foreground hover:text-foreground"
            >
              <XIcon className="size-4" />
            </Button>
          </SheetClose>
        </div>
        <SheetDescription className="sr-only">
          Dashboard navigation
        </SheetDescription>

        <DashboardNavigation />
      </SheetContent>
    </Sheet>
  );
}
