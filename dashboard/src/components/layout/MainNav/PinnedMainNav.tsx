import { Button } from '@/components/ui/v3/button';
import CreateOrgDialog from '@/features/orgs/CreateOrgFormDialog/CreateOrgFormDialog';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { Pin, PinOff } from 'lucide-react';
import NavTree from './NavTree';

export default function PinnedMainNav() {
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage<boolean>(
    'nav-tree-pin',
    false,
  );

  return (
    <div className="h-full w-full border-r p-0 sm:max-w-96">
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

      <div className="flex w-full flex-col px-4 pt-2">
        <NavTree />
        <CreateOrgDialog />
      </div>
    </div>
  );
}
