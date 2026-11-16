import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { UserSelect } from '@/features/orgs/projects/graphql/common/components/UserSelect';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';

/**
 * Component that combines user selection and role selection functionality
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
    <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
      <UserSelect
        className="col-span-1 md:col-auto md:w-52"
        onUserChange={handleUserChange}
      />

      <div className="col-span-1 flex flex-col gap-2 md:col-auto md:w-52">
        <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
          Role
        </span>
        <Select value={role} onValueChange={handleRoleChange}>
          <SelectTrigger
            aria-label="Role"
            data-testid="graphql-role-select"
            className="w-full"
          >
            <SelectValue placeholder="Select role" />
          </SelectTrigger>
          <SelectContent>
            {availableRoles.map((availableRole) => (
              <SelectItem value={availableRole} key={availableRole}>
                {availableRole}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
