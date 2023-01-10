import { useDialog } from '@/components/common/DialogProvider';
import { SidebarTitle } from '@/components/home/SidebarTitle';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import SidebarWorkspaces from './SidebarWorkspaces';

export function WorkspaceSection() {
  const { openDialog } = useDialog();

  return (
    <>
      <SidebarTitle text="My Workspaces" under={false} />
      <SidebarWorkspaces />

      <Button
        variant="borderless"
        color="secondary"
        onClick={() => {
          openDialog('EDIT_WORKSPACE_NAME', {
            title: (
              <span className="grid grid-flow-row">
                <span>New Workspace</span>

                <Text variant="subtitle1" component="span">
                  Invite team members to workspaces to work collaboratively.
                </Text>
              </span>
            ),
          });
        }}
        startIcon={<PlusCircleIcon />}
      >
        New Workspace
      </Button>
    </>
  );
}

export default WorkspaceSection;
