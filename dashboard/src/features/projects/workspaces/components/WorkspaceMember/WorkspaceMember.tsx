import { Avatar } from '@/components/ui/v1/Avatar';
import { Chip } from '@/components/ui/v2/Chip';
import { Text } from '@/components/ui/v2/Text';
import { ManageWorkspaceMemberMenu } from '@/features/projects/workspaces/components/ManageWorkspaceMemberMenu';
import type { GetWorkspaceMembersWorkspaceMemberFragment } from '@/utils/__generated__/graphql';
import { capitalize } from '@/utils/helpers';
import { useUserData } from '@nhost/nextjs';

export interface WorkspaceMemberProps {
  workspaceMember: GetWorkspaceMembersWorkspaceMemberFragment;
  isOwner: boolean;
}

export default function WorkspaceMember({
  workspaceMember,
  isOwner,
}: WorkspaceMemberProps) {
  const currentUser = useUserData();
  const isSelf = currentUser?.id === workspaceMember.user.id;

  return (
    <div className="mt-6 flex flex-row place-content-between">
      <div className="flex flex-row">
        <Avatar
          className="h-12 w-12"
          name={workspaceMember.user.displayName}
          avatarUrl={workspaceMember.user.avatarUrl}
        />
        <div className="ml-3 self-center">
          <div className="grid grid-flow-col items-center justify-start gap-2">
            <Text className="font-medium">
              {workspaceMember.user.displayName}
            </Text>
            {isSelf && <Chip size="small" color="info" label="Me" />}
          </div>
          <Text className="font-medium" color="disabled">
            {workspaceMember.user.email}
          </Text>
        </div>
      </div>
      <div className="flex flex-row self-center">
        {/* @TODO: Don't allow owner to remove themselves if there are no other owners on workspace. */}
        {isOwner && isSelf && (
          <Chip
            size="small"
            color="info"
            label={capitalize(workspaceMember.type)}
          />
        )}

        {isOwner && !isSelf && (
          <ManageWorkspaceMemberMenu workspaceMember={workspaceMember} />
        )}

        {!isOwner && !isSelf && (
          <Chip
            size="small"
            color="info"
            label={capitalize(workspaceMember.type)}
          />
        )}
      </div>
    </div>
  );
}
