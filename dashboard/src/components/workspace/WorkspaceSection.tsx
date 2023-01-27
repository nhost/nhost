import { useDialog } from '@/components/common/DialogProvider';
import Button from '@/ui/v2/Button';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import Text from '@/ui/v2/Text';
import SidebarWorkspaces from './SidebarWorkspaces';

export function WorkspaceSection() {
  const { openDialog } = useDialog();

  return (
    <div>
      <Text color="disabled">My Workspaces</Text>
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
    </div>
  );
}

export default WorkspaceSection;
