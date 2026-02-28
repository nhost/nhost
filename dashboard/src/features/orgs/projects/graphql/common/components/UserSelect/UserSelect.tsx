import { debounce } from '@mui/material/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import { isNotEmptyValue } from '@/lib/utils';
import {
  type RemoteAppGetUsersAndAuthRolesQuery,
  useRemoteAppGetUsersAndAuthRolesLazyQuery,
} from '@/utils/__generated__/graphql';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles: string[]) => void;
  /**
   * Class name to be applied to the `<Autocomplete />` element.
   */
  className?: string;
}

export default function UserSelect({
  onUserChange,
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

  const userApplicationClient = useRemoteApplicationGQLClient();

  const [fetchAppUsers, { loading }] =
    useRemoteAppGetUsersAndAuthRolesLazyQuery({
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
      label: user.displayName,
      group: 'Users',
    })),
  ];

  return (
    <Autocomplete
      {...props}
      id="user-select"
      label="Make request as"
      options={autocompleteOptions}
      defaultValue={{
        value: 'admin',
        label: 'Admin',
        group: 'Admin',
      }}
      autoComplete
      fullWidth
      autoSelect
      groupBy={(option) => option.group ?? ''}
      autoHighlight
      includeInputInList
      loading={loading}
      onChange={(_event, _value, _reason, details) => {
        setActive(false);
        const userId = details?.option.value;
        if (typeof userId !== 'string') {
          return;
        }

        if (userId === 'admin') {
          onUserChange('admin', getAdminRoles(adminAuthRoles));
          return;
        }

        const user: RemoteAppGetUsersAndAuthRolesQuery['users'][number] =
          users.find(({ id }) => id === userId)!;

        if (isNotEmptyValue(user?.roles)) {
          const roles = user.roles.map(({ role }) => role);

          onUserChange(userId, roles);
        }
      }}
      onInputChange={(_event, newInputValue) => {
        setInputValue(newInputValue);
      }}
    />
  );
}
