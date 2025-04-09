import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { UserSelect } from '@/features/orgs/projects/graphql/common/components/UserSelect';
import { DEFAULT_ROLES } from '@/features/orgs/projects/graphql/common/utils/constants';
import { useState } from 'react';

/**
 * Component that combines user selection and role selection functionality
 */
interface UserAndRoleSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string) => void;
  /**
   * Function to be called when the role changes.
   */
  onRoleChange: (role: string) => void;
}

export default function UserAndRoleSelect({
  onUserChange,
  onRoleChange,
}: UserAndRoleSelectProps) {
  const [availableRoles, setAvailableRoles] = useState<string[]>(DEFAULT_ROLES);
  const [role, setRole] = useState<string>(() => availableRoles[0]);

  const handleUserChange = (userId: string, availableUserRoles: string[]) => {
    onUserChange(userId);
    setAvailableRoles(availableUserRoles);

    if (availableUserRoles[0]) {
      setRole(availableUserRoles[0]);
      onRoleChange(availableUserRoles[0]);
    }
  };

  return (
    <div className="grid grid-cols-2 gap-2 md:grid-flow-col md:grid-cols-[initial]">
      <UserSelect
        className="col-span-1 md:col-auto md:w-52"
        onUserChange={handleUserChange}
      />

      <Select
        id="role-select"
        label="Role"
        value={role}
        onChange={(_event, value) => {
          if (typeof value === 'string') {
            setRole(value);
            onRoleChange(value);
          }
        }}
        hideEmptyHelperText
        className="col-span-1 md:col-auto md:w-52"
      >
        {availableRoles.map((availableRole) => (
          <Option value={availableRole} key={availableRole}>
            {availableRole}
          </Option>
        ))}
      </Select>
    </div>
  );
}
