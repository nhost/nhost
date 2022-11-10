import { WorkspaceMemberManageMenu } from '@/components/workspace/WorkspaceMemberManageMenu';
import { Avatar } from '@/ui/Avatar';
import { Badge } from '@/ui/Badge';
import { Text } from '@/ui/Text';
import { nhost } from '@/utils/nhost';
import type { GetWorkspaceMembersWorkspaceMemberFragment } from '@/utils/__generated__/graphql';

export interface WorkspaceMemberProps {
  workspaceMember: GetWorkspaceMembersWorkspaceMemberFragment;
  isOwner: boolean;
}

export default function WorkspaceMember({
  workspaceMember,
  isOwner,
}: WorkspaceMemberProps) {
  const user = nhost.auth.getUser();
  const isSelf = user?.id === workspaceMember.user.id;

  return (
    <div className="mt-6 flex flex-row place-content-between">
      <div className=" flex flex-row">
        <Avatar
          className="h-12 w-12"
          name={workspaceMember.user.displayName}
          avatarUrl={workspaceMember.user.avatarUrl}
        />
        <div className="ml-3 self-center">
          <div className="flex flex-row">
            <Text
              variant="body"
              size="normal"
              color="greyscaleDark"
              className="font-medium"
            >
              {workspaceMember.user.displayName}
            </Text>
            {isSelf && <Badge>Me</Badge>}
          </div>
          <Text
            variant="body"
            size="normal"
            color="greyscaleGrey"
            className="font-medium"
          >
            {workspaceMember.user.email}
          </Text>
        </div>
      </div>
      <div className="flex flex-row self-center">
        {/* @TODO: Don't allow owner to remove themselves if there are no other owners on workspace. */}
        {isOwner && isSelf && <Badge>{workspaceMember.type}</Badge>}

        {isOwner && !isSelf && (
          <WorkspaceMemberManageMenu workspaceMember={workspaceMember} />
        )}

        {!isOwner && !isSelf && <Badge>{workspaceMember.type}</Badge>}
      </div>
    </div>
  );
}
