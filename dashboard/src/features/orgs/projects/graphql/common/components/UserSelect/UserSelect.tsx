import { debounce } from '@mui/material/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Combobox } from '@/components/ui/v3/combobox';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import {
  type RemoteAppGetUsersAndAuthRolesQuery,
  useRemoteAppGetUsersAndAuthRolesLazyQuery,
} from '@/generated/graphql';
import { cn, isNotEmptyValue } from '@/lib/utils';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles: string[]) => void;
  /**
   * Class name to be applied to the container element.
   */
  className?: string;
}

export default function UserSelect({
  onUserChange,
  className,
  ...props
}: UserSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [users, setUsers] = useState<
    RemoteAppGetUsersAndAuthRolesQuery['users']
  >([]);
  const [active, setActive] = useState(true);
  const [adminAuthRoles, setAdminAuthRoles] = useState<string[]>(() =>
    getAdminRoles(),
  ); // Roles from the auth.roles table
  const [selectedUserId, setSelectedUserId] = useState<string>('admin');

  const userApplicationClient = useRemoteApplicationGQLClient();

  const [fetchAppUsers] = useRemoteAppGetUsersAndAuthRolesLazyQuery({
    client: userApplicationClient,
    variables: {
      where: {},
      limit: 250,
      offset: 0,
    },
  });

  const fetchUsers = useCallback(
    async (
      request: { input: string },
      callback: (results?: RemoteAppGetUsersAndAuthRolesQuery) => void,
    ) => {
      const ilike = `%${request.input === 'Admin' ? '' : request.input}%`;
      const { data } = await fetchAppUsers({
        client: userApplicationClient,
        variables: {
          where: {
            displayName: { _ilike: ilike },
          },
          limit: 250,
          offset: 0,
        },
      });

      callback(data);
    },
    [fetchAppUsers, userApplicationClient],
  );

  const fetchOptions = useMemo(() => debounce(fetchUsers, 1000), [fetchUsers]);

  useEffect(() => {
    fetchOptions({ input: inputValue }, (results) => {
      if (active || inputValue === '') {
        if (
          isNotEmptyValue(results?.users) &&
          isNotEmptyValue(results?.authRoles)
        ) {
          setUsers(results.users);
          const newAuthRoles = results.authRoles.map(
            (authRole) => authRole.role,
          );
          setAdminAuthRoles(newAuthRoles);
        } else {
          setUsers([]);
          setAdminAuthRoles(getAdminRoles());
        }
      }
    });
  }, [inputValue, fetchOptions, active]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: only want to run the effect when adminAuthRoles changes
  useEffect(() => {
    onUserChange('admin', getAdminRoles(adminAuthRoles));
  }, [adminAuthRoles]);

  const autocompleteOptions = [
    {
      value: 'admin',
      label: 'Admin',
      group: 'Admin',
    },
    ...users.map((user) => ({
      value: user.id,
      label: user.displayName || user.id,
      group: 'Users',
    })),
  ];

  return (
    <div className={cn('flex w-full flex-col gap-2', className)}>
      <span className="font-semibold text-muted-foreground text-xs uppercase tracking-wider">
        Make request as
      </span>
      <Combobox
        {...props}
        value={selectedUserId}
        onChange={(value) => {
          if (!value) {
            return;
          }
          setActive(false);
          setSelectedUserId(value);

          if (value === 'admin') {
            onUserChange('admin', getAdminRoles(adminAuthRoles));
            return;
          }

          const user = users.find(({ id }) => id === value);
          if (user && isNotEmptyValue(user.roles)) {
            const roles = user.roles.map(({ role }) => role);
            onUserChange(value, roles);
          }
        }}
        options={autocompleteOptions}
        placeholder="Select user..."
        className="w-full"
        popoverContentClassName="w-80"
        onSearchChange={setInputValue}
      />
    </div>
  );
}
