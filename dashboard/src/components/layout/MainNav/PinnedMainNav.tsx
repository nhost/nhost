import NavTree from '@/components/layout/MainNav/NavTree';
import { Button } from '@/components/ui/v3/button';
import { Separator } from '@/components/ui/v3/separator';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { Pin, PinOff } from 'lucide-react';
import WorkspacesNavTree from './WorkspacesNavTree';

export default function PinnedMainNav() {
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage<boolean>(
    'nav-tree-pin',
    false,
  );

  return (
    <div className="h-full w-full border-r p-0 sm:max-w-96">
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

      <div className="h-[calc(100vh-6rem)] overflow-auto pb-12 pt-2">
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
