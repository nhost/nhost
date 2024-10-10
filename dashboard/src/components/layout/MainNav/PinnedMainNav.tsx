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