import { useState } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
import { UserSelect } from '@/features/orgs/projects/graphql/common/components/UserSelect';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

/**
 * "Request as": the user picker, and next to it the role, a searchable dropdown
 * so it works for any number of roles.
 */
interface UserAndRoleSelectProps {
  /**
   * Function to be called when the user or role changes.
   */
  onSelectionChange: (selection: GraphQLPlaygroundSelection) => void;
}

export default function UserAndRoleSelect({
  onSelectionChange,
}: UserAndRoleSelectProps) {
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [userId, setUserId] = useState('');
  const [role, setRole] = useState('');
  const handleUserChange = (
    nextUserId: string,
    availableUserRoles: string[],
  ) => {
    setAvailableRoles(availableUserRoles);

    const shouldKeepCurrentRole =
      nextUserId === userId && availableUserRoles.includes(role);
    const nextRole = shouldKeepCurrentRole
      ? role
      : (availableUserRoles[0] ?? '');

    setUserId(nextUserId);
    setRole(nextRole);
    onSelectionChange({ userId: nextUserId, role: nextRole });
  };

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    onSelectionChange({ userId, role: nextRole });
  };

  return (
    <div className="flex min-w-0 items-center gap-2">
      <UserSelect onUserChange={handleUserChange} />
      <span className="shrink-0 text-muted-foreground text-sm">with role</span>
      <Combobox
        value={role || null}
        onChange={handleRoleChange}
        options={availableRoles.map((availableRole) => ({
          value: availableRole,
          label: availableRole,
        }))}
        placeholder="Role"
        aria-label="Role"
        searchPlaceholder="Search roles..."
        emptyText="No role found."
        disabled={availableRoles.length === 0}
        className="h-10 w-44 font-mono"
        triggerLabel={
          role ? <span data-testid="graphql-role-tag">{role}</span> : undefined
        }
      />
    </div>
  );
}
