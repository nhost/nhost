import { useState } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { UserSelect } from '@/features/orgs/projects/graphql/common/components/UserSelect';

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
  const [availableRoles, setAvailableRoles] = useState<string[]>([]);
  const [role, setRole] = useState<string>(() => availableRoles[0]);

  const handleUserChange = (userId: string, availableUserRoles: string[]) => {
    onUserChange(userId);
    setAvailableRoles(availableUserRoles);

    const newRole = availableUserRoles[0];

    if (newRole) {
      setRole(newRole);
      onRoleChange(newRole);
    }
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
        <Select
          value={role}
          onValueChange={(value) => {
            setRole(value);
            onRoleChange(value);
          }}
        >
          <SelectTrigger className="w-full">
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
