import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { DEFAULT_ROLES } from '@/features/graphql/common/utils/constants';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import {
  useRemoteAppGetUsersCustomLazyQuery,
  type RemoteAppGetUsersCustomQuery,
} from '@/utils/__generated__/graphql';
import { debounce } from '@mui/material';
import { useEffect, useMemo, useState, type SyntheticEvent } from 'react';

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

  const userApplicationClient = useRemoteApplicationGQLClient();
  const [fetchUsers, { loading }] = useRemoteAppGetUsersCustomLazyQuery({
    client: userApplicationClient,
    variables: {
      where: {},
      limit: 250,
      offset: 0,
    },
  });

  const [options, setOptions] = useState([]);

  // useEffect(() => {
  //   setInterval(() => {
  //     const i = Math.random();
  //     setOptions([
  //       ...options,
  //       {
  //         value: `${i}`,
  //         label: `User ${i}`,
  //         group: 'Users',
  //       },
  //     ]);
  //   }, 3000);
  // }, [options]);

  const handleSearchStringChange = useMemo(
    () =>
      debounce(
        async (
          value: string,
          callback: (results: RemoteAppGetUsersCustomQuery) => void,
        ) => {
          const { data, error } = await fetchUsers({
            variables: {
              where: value
                ? {
                    displayName: { _ilike: `%${value}%` },
                  }
                : {},
              limit: 250,
              offset: 0,
            },
          });
          callback(data);
        },
        500,
      ),
    [fetchUsers],
  );

  useEffect(() => {
    let active = true;
    if (inputValue === '') {
      setOptions([]);
      return;
    }

    handleSearchStringChange(inputValue, (data) => {
      if (active) {
        const users = data?.users || [];
        const userOptions = users.map((user) => ({
          value: user.id,
          label: user.displayName || user.email || user.phoneNumber || user.id,
          group: 'Users',
        }));

        // setOptions(userOptions);
      }
    });

    return () => {
      active = false;
    };
  }, [handleSearchStringChange, inputValue]);

  // useEffect(
  //   () => () => handleSearchStringChange.cancel(),
  //   [handleSearchStringChange],
  // );

  const handleInputChange = (_event: SyntheticEvent, value: string) => {
    setInputValue(value);
  };

  if (loading) {
    return (
      <div className={props.className}>
        <ActivityIndicator label="Loading users..." delay={500} />
      </div>
    );
  }

  // if (globalError) {
  //   throw globalError;
  // }

  return (
    <Autocomplete
      {...props}
      label="Make request as"
      id="user-select"
      defaultValue={{
        value: 'admin',
        label: 'Admin',
        group: 'Admin',
      }}
      inputValue={inputValue}
      onInputChange={handleInputChange}
      options={options}
      filterOptions={(x) => x}
      filterSelectedOptions
      includeInputInList
      groupBy={(option) => option.group}
      fullWidth
      disableClearable
      autoSelect
      autoHighlight
      isOptionEqualToValue={
        // (option, _value) => option.value === _value.value
        () => false
      }
      onChange={(_event, _value, reason, details) => {
        const userId = details.option.value;
        if (typeof userId !== 'string') {
          return;
        }

        if (userId === 'admin') {
          onUserChange('admin', DEFAULT_ROLES);

          return;
        }

        // const user: RemoteAppGetUsersCustomQuery['users'][0] =
        //   globalData?.users.find(({ id }) => id === userId);

        // const roles = user?.roles.map(({ role }) => role);

        onUserChange(userId, DEFAULT_ROLES);
      }}
    />
  );
}
