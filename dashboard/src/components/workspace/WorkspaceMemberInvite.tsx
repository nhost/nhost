import { Avatar } from '@/ui/Avatar';
import Chip from '@/ui/v2/Chip';
import Text from '@/ui/v2/Text';
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
    <div className="flex flex-row place-content-between">
      <div className=" flex flex-row">
        <Avatar className="h-12 w-12" name={workspaceMemberInvite.email} />
        <div className="ml-3 self-center">
          <div className="grid grid-flow-col justify-start gap-2">
            <Text className="font-medium">{workspaceMemberInvite.email}</Text>
            <Chip size="small" color="info" label="Pending Invitation" />
          </div>
          <Text className="font-medium" color="disabled">
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
          <Text
            className="self-center font-display text-sm font-medium capitalize"
            sx={{ color: 'primary.main' }}
          >
            {workspaceMemberInvite.memberType}
          </Text>
        )}
      </div>
    </div>
  );
}
