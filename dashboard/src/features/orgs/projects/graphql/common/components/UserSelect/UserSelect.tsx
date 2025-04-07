import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { DEFAULT_ROLES } from '@/features/orgs/projects/graphql/common/utils/constants';
import { getAdminRoles } from '@/features/orgs/projects/roles/settings/utils/getAdminRoles';
import {
  useRemoteAppGetUsersAndAuthRolesLazyQuery,
  type RemoteAppGetUsersAndAuthRolesQuery,
  type RemoteAppGetUsersCustomQuery,
} from '@/utils/__generated__/graphql';
import { debounce } from '@mui/material/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles?: string[]) => void;
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
  const [users, setUsers] = useState([]);
  const [active, setActive] = useState(true);
  const [authRoles, setAuthRoles] = useState<string[]>(DEFAULT_ROLES);

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
        setUsers(results?.users || []);
        const newAuthRoles =
          results?.authRoles?.map((authRole) => authRole.role) || DEFAULT_ROLES;
        console.log('newAuthRoles', newAuthRoles);
        setAuthRoles(newAuthRoles);
        onUserChange('admin', getAdminRoles(newAuthRoles));
      }
    });
  }, [inputValue, fetchOptions, active]);

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
      groupBy={(option) => option.group}
      autoHighlight
      includeInputInList
      loading={loading}
      onChange={(_event, _value, reason, details) => {
        setActive(false);
        const userId = details.option.value;
        if (typeof userId !== 'string') {
          return;
        }

        fetchUsers({ input: '' }, (results) => {
          if (results) {
            setUsers(results?.users || []);
            const newAuthRoles =
              results?.authRoles?.map((authRole) => authRole.role) ||
              DEFAULT_ROLES;
            setAuthRoles(newAuthRoles);
          }
        });

        if (userId === 'admin') {
          onUserChange('admin', getAdminRoles(authRoles ?? DEFAULT_ROLES));

          return;
        }

        const user: RemoteAppGetUsersCustomQuery['users'][0] = users.find(
          ({ id }) => id === userId,
        );

        const roles = user?.roles?.map(({ role }) => role);

        onUserChange(userId, roles ?? DEFAULT_ROLES);
      }}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
    />
  );
}
