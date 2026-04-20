import { Shield } from 'lucide-react';
import { useDialog } from '@/components/common/DialogProvider';
import { Button } from '@/components/ui/v3/button';
import { StoragePermissionsForm } from '@/features/orgs/projects/storage/dataGrid/components/EditStoragePermissions';

export default function StoragePermissionsButton() {
  const { openDrawer, closeDrawerWithDirtyGuard } = useDialog();

  function openPermissionsDrawer() {
    openDrawer({
      title: 'Permissions for storage files',
      component: (
        <StoragePermissionsForm onCancel={closeDrawerWithDirtyGuard} />
      ),
      props: {
        PaperProps: {
          className: 'lg:w-[65%] lg:max-w-7xl',
        },
      },
    });
  }

  return (
    <Button
      size="sm"
      variant="link"
      className="flex w-full rounded-none border text-sm+ hover:bg-accent hover:no-underline"
      onClick={openPermissionsDrawer}
    >
      <div className="flex w-full flex-row items-center justify-center space-x-4">
        <Shield />
        <span className="flex">Permissions</span>
      </div>
    </Button>
  );
}
