import NavTree from '@/components/layout/MainNav/NavTree';
import { Button } from '@/components/ui/v3/button';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { Pin, PinOff } from 'lucide-react';

export default function PinnedMainNav() {
  const [mainNavPinned, setMainNavPinned] = useSSRLocalStorage<boolean>(
    'nav-tree-pin',
    false,
  );

  return (
    <div className="w-full h-full p-0 border-r sm:max-w-96">
      <div className="flex justify-end w-full p-1 bg-background">
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

      <div className="flex flex-col w-full px-4 pt-2">
        <NavTree />
        <CreateOrgDialog />
      </div>
    </div>
  );
}
