import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';

export interface RemoveWorkspaceMemberProps {
  /**
   * Function to be called when the user clicks on cancel.
   */
  close: VoidFunction;
  /**
   * Function to be called when the user clicks on remove.
   */
  handler: VoidFunction;
}

export default function RemoveWorkspaceMember({
  close,
  handler,
}: RemoveWorkspaceMemberProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <Box className="grid w-miniModal grid-flow-row gap-2 rounded-lg px-6 py-6 text-left">
      <div className="grid grid-flow-row">
        <Text className="text-lg font-medium">
          Remove Member from {currentWorkspace.name}?
        </Text>

        <Text>
          They can no longer access any of the apps in this workspace. You can
          invite them back later if you change your mind.
        </Text>
      </div>

      <div className="grid grid-flow-row gap-2">
        <Button color="error" onClick={handler}>
          Remove Workspace Member
        </Button>

        <Button variant="outlined" color="secondary" onClick={close}>
          Cancel
        </Button>
      </div>
    </Box>
  );
}
