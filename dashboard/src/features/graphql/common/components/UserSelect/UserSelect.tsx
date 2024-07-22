import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { DEFAULT_ROLES } from '@/features/graphql/common/utils/constants';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { RemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import debounce from 'lodash.debounce';
import { SyntheticEvent, useState } from 'react';

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
  const [queryFilter, setQueryFilter] = useState('');
  const { currentProject } = useCurrentWorkspaceAndProject();
  const userApplicationClient = useRemoteApplicationGQLClient();
  console.log('inputValue', inputValue);
  const { data, loading, error } = useRemoteAppGetUsersCustomQuery({
    client: userApplicationClient,
    variables: {
      where: {
        displayName: { _ilike: `%${queryFilter}%` },
      },
      limit: 250,
      offset: 0,
    },
    skip: !currentProject,
  });

  const debounceQueryFilter = debounce(() => {
    setQueryFilter(inputValue)
  }, 1000);

  const handleInputChange = (_event: SyntheticEvent, value: string) => {
    setInputValue(value);
    debounceQueryFilter();
  }

  if (loading) {
    return (
      <div className={props.className}>
        <ActivityIndicator label="Loading users..." delay={500} />
      </div>
    );
  }

  if (error) {
    throw error;
  }

  const autocompleteOptions = [
    {
      value: 'admin',
      label: 'Admin',
      group: 'Admin',
    },
  ];

  data?.users.forEach((user) => {
    autocompleteOptions.push({
      value: user.id,
      label: user.displayName || user.email || user.phoneNumber || user.id,
      group: 'Users',
    });
  });

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
      options={autocompleteOptions}
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

        const user: RemoteAppGetUsersCustomQuery['users'][0] = data?.users.find(
          ({ id }) => id === userId,
        );

        const roles = user?.roles.map(({ role }) => role);

        onUserChange(user.id, roles);
      }}
    />
  );
}
