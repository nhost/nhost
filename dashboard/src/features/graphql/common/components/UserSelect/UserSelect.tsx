import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import {
  useRemoteAppGetUsersCustomLazyQuery,
  type RemoteAppGetUsersCustomQuery,
} from '@/utils/__generated__/graphql';
import { debounce } from '@mui/material/utils';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DEFAULT_ROLES } from '../../utils/constants';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles?: string[]) => void;
  /**
   * Class name to be applied to the `<Select />` element.
   */
  className?: string;
}

export default function UserSelect({
  onUserChange,
  ...props
}: UserSelectProps) {
  const [inputValue, setInputValue] = useState('');
  const [users, setUsers] = useState([]);
  const [options, setOptions] = useState([]);
  const [active, setActive] = useState(true);

  const userApplicationClient = useRemoteApplicationGQLClient();

  const [fetchAppUsers, { loading }] = useRemoteAppGetUsersCustomLazyQuery({
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
      callback: (results?: RemoteAppGetUsersCustomQuery['users']) => void,
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

      callback(data?.users);
    },
    [fetchAppUsers, userApplicationClient],
  );

  const fetchOptions = useMemo(() => debounce(fetchUsers, 1000), [fetchUsers]);

  // const inputCooldown = useMemo(() => debounce(() => {}, 1000), [inputValue]);

  useEffect(() => {
    // if (inputValue === '') {
    //   setOptions(value ? [value] : []);
    //   return undefined;
    // }

    fetchOptions({ input: inputValue }, (results) => {
      if (active || inputValue === '') {
        const mappedResults = results.map((result) => ({
          value: result.id,
          label: result.displayName,
          group: 'Users',
        }));
        const autocompleteOptions = [
          {
            value: 'admin',
            label: 'Admin',
            group: 'Admin',
          },
          ...mappedResults,
        ];
        setOptions(autocompleteOptions);
        setUsers(results);
      }
    });

    // return () => {
    //   active = false;
    // };
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
      onChange={(_event, _value, reason, details) => {
        setActive(false);
        const userId = details.option.value;
        if (typeof userId !== 'string') {
          return;
        }

        if (userId === 'admin') {
          onUserChange('admin', DEFAULT_ROLES);

          return;
        }

        const user: RemoteAppGetUsersCustomQuery['users'][0] = users.find(
          ({ id }) => id === userId,
        );

        const roles = user?.roles?.map(({ role }) => role);

        onUserChange(userId, roles ?? DEFAULT_ROLES);

        fetchUsers({ input: '' }, (results) => {
          if (results) {
            const mappedResults = results.map((result) => ({
              value: result.id,
              label: result.displayName,
              group: 'Users',
            }));
            const newAutocompleteOptions = [
              {
                value: 'admin',
                label: 'Admin',
                group: 'Admin',
              },
              ...mappedResults,
            ];
            setOptions(newAutocompleteOptions);
            setUsers(results);
          }
        });
      }}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
    />
  );
}
