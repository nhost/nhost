import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import {
  useRemoteAppGetUsersCustomLazyQuery,
  type RemoteAppGetUsersCustomQuery,
} from '@/utils/__generated__/graphql';
import { debounce } from '@mui/material/utils';
import { useEffect, useMemo, useState } from 'react';
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
  const [options, setOptions] = useState([]);

  const userApplicationClient = useRemoteApplicationGQLClient();

  const [fetchAppUsers, { data, previousData, loading }] =
    useRemoteAppGetUsersCustomLazyQuery({
      client: userApplicationClient,
      variables: {
        where: {},
        limit: 250,
        offset: 0,
      },
    });

  const fetchOptions = useMemo(
    () =>
      debounce(
        async (
          request: { input: string },
          callback: (results?: RemoteAppGetUsersCustomQuery['users']) => void,
        ) => {
          const { data } = await fetchAppUsers({
            client: userApplicationClient,
            variables: {
              where: {
                displayName: { _ilike: `%${request.input}%` },
              },
              limit: 250,
              offset: 0,
            },
          });

          callback(data?.users);
        },
        1000,
      ),
    [],
  );

  // const inputCooldown = useMemo(() => debounce(() => {}, 1000), [inputValue]);

  useEffect(() => {
    let active = true;

    // if (inputValue === '') {
    //   setOptions(value ? [value] : []);
    //   return undefined;
    // }
    //const fetchInput = inputCooldown ? '' : inputValue;

    // setTimeout(() => {
    //   setInputCooldown(false);
    // }, 1000);

    fetchOptions({ input: inputValue }, (results) => {
      if (active) {
        const mappedResults = results.map((result) => ({
          value: result.displayName,
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
      }
    });

    return () => {
      active = false;
    };
  }, [inputValue, fetchOptions]);

  return (
    <Autocomplete
      {...props}
      id="user-select"
      label="Make request as"
      options={options}
      autoComplete
      fullWidth
      autoSelect
      groupBy={(option) => option.group}
      autoHighlight
      includeInputInList
      onChange={(_event, _value, reason, details) => {
        const userId = details.option.value;
        console.log('data:', data);
        if (typeof userId !== 'string') {
          return;
        }

        if (userId === 'admin') {
          onUserChange('admin', DEFAULT_ROLES);

          return;
        }
        const availableData = data ?? previousData;

        const user: RemoteAppGetUsersCustomQuery['users'][0] =
          availableData?.users.find(({ id }) => id === userId);

        const roles = user?.roles?.map(({ role }) => role);

        onUserChange(userId, roles ?? DEFAULT_ROLES);
      }}
      // onOpen={() => {
      //   console.log('HELO');
      // }}
      // onChange={(event: any, newValue: PlaceType | null, reason, details) => {
      //   setOptions(newValue ? [newValue, ...options] : options);
      //   setValue(newValue);
      // }}
      onInputChange={(event, newInputValue) => {
        setInputValue(newInputValue);
      }}
    />
  );
}
