import { useState } from 'react';
import { Button } from '@/components/ui/v3/button';
import { Input } from '@/components/ui/v3/input';
import { UserSelect } from '@/features/orgs/projects/graphql/common/components/UserSelect';
import type { GraphQLPlaygroundSelection } from '@/features/orgs/projects/graphql/common/utils/composeRequestHeaders';
import { cn } from '@/lib/utils';

// Up to this many roles the chips are enough. Projects can have any number of
// roles, so above it a search box filters the chips and the list scrolls.
const ROLE_SEARCH_THRESHOLD = 8;

/**
 * One "Request as" control: the user picker with the role chips below it.
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
  const [roleSearch, setRoleSearch] = useState('');

  const hasManyRoles = availableRoles.length > ROLE_SEARCH_THRESHOLD;
  const search = roleSearch.trim().toLowerCase();
  // The selected role stays visible while searching, so it's never hidden.
  const shownRoles =
    hasManyRoles && search
      ? availableRoles.filter(
          (availableRole) =>
            availableRole === role ||
            availableRole.toLowerCase().includes(search),
        )
      : availableRoles;

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

    if (nextUserId !== userId) {
      setRoleSearch('');
    }
    setUserId(nextUserId);
    setRole(nextRole);
    onSelectionChange({ userId: nextUserId, role: nextRole });
  };

  const handleRoleChange = (nextRole: string) => {
    setRole(nextRole);
    onSelectionChange({ userId, role: nextRole });
  };

  return (
    <UserSelect
      onUserChange={handleUserChange}
      triggerSuffix={
        role ? (
          <>
            <span className="text-muted-foreground"> with role </span>
            <span
              data-testid="graphql-role-tag"
              className="font-medium text-foreground"
            >
              {role}
            </span>
          </>
        ) : null
      }
    >
      <fieldset className="border-t px-3 pt-2 pb-3">
        <legend className="float-left w-full font-medium text-muted-foreground text-xs">
          Role
        </legend>
        {hasManyRoles && (
          <Input
            value={roleSearch}
            onChange={(event) => setRoleSearch(event.target.value)}
            placeholder="Search roles..."
            aria-label="Search roles"
            className="mt-2 h-8 text-xs"
          />
        )}
        <div
          className={cn(
            'flex w-full flex-wrap gap-1.5 pt-2',
            hasManyRoles && 'max-h-32 overflow-y-auto',
          )}
        >
          {shownRoles.map((availableRole) => {
            const isSelected = availableRole === role;

            return (
              <Button
                key={availableRole}
                type="button"
                variant="outline"
                size="xs"
                aria-pressed={isSelected}
                onClick={() => handleRoleChange(availableRole)}
                className={cn(
                  'px-3 font-mono text-muted-foreground text-xs',
                  isSelected &&
                    'border-primary bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary',
                )}
              >
                {availableRole}
              </Button>
            );
          })}
        </div>
        <p className="mt-2 text-muted-foreground text-xs">
          {userId
            ? 'Roles this user can use. The first one is the default.'
            : 'Every role in the project. Admin sends the admin secret.'}
        </p>
      </fieldset>
    </UserSelect>
  );
}
