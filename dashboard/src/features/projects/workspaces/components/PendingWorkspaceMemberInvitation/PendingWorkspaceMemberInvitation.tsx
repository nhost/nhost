import { Avatar } from '@/components/ui/v1/Avatar';
import { Chip } from '@/components/ui/v2/Chip';
import { Text } from '@/components/ui/v2/Text';
import { ManageWorkspaceMemberInviteMenu } from '@/features/projects/workspaces/components/ManageWorkspaceMemberInviteMenu';
import type { GetWorkspaceMembersWorkspaceMemberInviteFragment } from '@/utils/__generated__/graphql';

export interface PendingWorkspaceMemberInvitationProps {
  workspaceMemberInvite: GetWorkspaceMembersWorkspaceMemberInviteFragment;
  isOwner: boolean;
}

export default function PendingWorkspaceMemberInvitation({
  workspaceMemberInvite,
  isOwner,
}: PendingWorkspaceMemberInvitationProps) {
  return (
    <div className="flex flex-row place-content-between">
      <div className="flex flex-row">
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
      <div className="right-0 flex flex-row self-center">
        {isOwner ? (
          <ManageWorkspaceMemberInviteMenu
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
