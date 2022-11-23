import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Button } from '@/ui/Button';
import { Text } from '@/ui/Text';

export interface RemoveWorkspaceMemberInviteProps {
  /**
   * Function to be called when the user clicks on cancel.
   */
  close: VoidFunction;
  /**
   * Function to be called when the user clicks on remove.
   */
  handler: VoidFunction;
}

export default function RemoveWorkspaceMemberInvite({
  close,
  handler,
}: RemoveWorkspaceMemberInviteProps) {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="w-miniModal px-6 py-6 text-left">
      <div className="flex flex-col">
        <Text variant="subHeading" color="greyscaleDark" size="large">
          Remove Invite from {currentWorkspace.name}?
        </Text>
        <Text
          variant="body"
          color="greyscaleDark"
          size="small"
          className="mt-2 font-normal"
        >
          They can no longer access any of the projects in this workspace. You
          can invite them back later if you change your mind.
        </Text>

        <div className="mt-2 flex flex-col">
          <Button border color="red" className="font-medium" onClick={handler}>
            Remove Workspace Invite
          </Button>
        </div>
        <Button
          className="text-grayscaleDark mt-2 text-sm+ font-normal"
          transparent
          onClick={close}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
