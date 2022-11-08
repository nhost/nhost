import { SidebarTitle } from '@/components/home/SidebarTitle';
import { useUI } from '@/context/UIContext';
import Button from '@/ui/v2/Button';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import SidebarWorkspaces from './SidebarWorkspaces';

export function WorkspaceSection() {
  const { openSection } = useUI();

  return (
    <>
      <SidebarTitle text="My Workspaces" under={false} />
      <SidebarWorkspaces />

      <Button
        variant="borderless"
        color="secondary"
        onClick={openSection}
        startIcon={<PlusCircleIcon />}
      >
        New Workspace
      </Button>
    </>
  );
}

export default WorkspaceSection;
