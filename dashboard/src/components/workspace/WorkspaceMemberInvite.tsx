import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Text } from '@/ui/Text';
import type { GetWorkspaceMembersWorkspaceMemberInviteFragment } from '@/utils/__generated__/graphql';
import { WorkspaceMemberInviteManageMenu } from './WorkspaceMemberInviteManageMenu';

export default function WorkspaceMemberInvite({
  workspaceMemberInvite,
  isOwner,
}: {
  workspaceMemberInvite: GetWorkspaceMembersWorkspaceMemberInviteFragment;
  isOwner: boolean;
}) {
  return (
    <div className="mt-14 flex flex-row place-content-between">
      <div className=" flex flex-row">
        <Avatar className="h-12 w-12" name={workspaceMemberInvite.email} />
        <div className="ml-3 self-center">
          <div className="flex flex-row">
            <Text
              variant="body"
              size="normal"
              color="greyscaleDark"
              className="font-medium"
            >
              {workspaceMemberInvite.email}
            </Text>
            <Badge>Pending Invitation</Badge>
          </div>
          <Text
            variant="body"
            size="normal"
            color="greyscaleGrey"
            className="font-medium"
          >
            {workspaceMemberInvite.email}
          </Text>
        </div>
      </div>
      <div className=" right-0 flex flex-row self-center">
        {isOwner ? (
          <WorkspaceMemberInviteManageMenu
            workspaceMemberInvite={workspaceMemberInvite}
          />
        ) : (
          <div className="self-center font-display text-sm font-medium capitalize text-blue">
            {workspaceMemberInvite.memberType}
          </div>
        )}
      </div>
    </div>
  );
}
