import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Autocomplete } from '@/components/ui/v2/Autocomplete';
import { DEFAULT_ROLES } from '@/features/graphql/common/utils/constants';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import type { RemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';

export interface UserSelectProps {
  /**
   * Function to be called when the user changes.
   */
  onUserChange: (userId: string, availableRoles?: string[]) => void;
  /**
   * Class name to be applied to the `<Select />` element.
   */
  className?: string;
  /**
   * Whether the user select should be disabled.
   */
  formError?: boolean;
}

export default function UserSelect({
  onUserChange,
  formError,
  ...props
}: UserSelectProps) {
  const { currentProject } = useCurrentWorkspaceAndProject();
  const userApplicationClient = useRemoteApplicationGQLClient();
  const { data, loading, error } = useRemoteAppGetUsersCustomQuery({
    client: userApplicationClient,
    variables: { where: {}, limit: 250, offset: 0 },
    skip: !currentProject,
  });

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
      options={autocompleteOptions}
      groupBy={(option) => option.group}
      fullWidth
      disableClearable
      autoSelect
      autoHighlight
      isOptionEqualToValue={(option, value) => {
        // if (typeof value === 'string') {
        //   return (
        //     option.value.toLowerCase() ===
        //     (value as string).toLowerCase()
        //   );
        // }

        // return (
        //   option.value.toLowerCase() === value.value.toLowerCase()
        // );
        //
        return false;
      }}
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

    // <Select
    //   {...props}
    //   id="user-select"
    //   label="Make Request As"
    //   hideEmptyHelperText
    //   defaultValue="admin"
    //   slotProps={{ root: { className: 'truncate' } }}
    //   onChange={(_event, userId) => {
    //     if (typeof userId !== 'string') {
    //       return;
    //     }

    //     if (userId === 'admin') {
    //       onUserChange('admin', DEFAULT_ROLES);

    //       return;
    //     }

    //     const user: RemoteAppGetUsersCustomQuery['users'][0] = data?.users.find(
    //       ({ id }) => id === userId,
    //     );

    //     const roles = user?.roles.map(({ role }) => role);

    //     onUserChange(user.id, roles);
    //   }}
    // >
    //   <Option value="admin">Admin</Option>

    //   {data?.users.map(({ id, displayName, email, phoneNumber }) => (
    //     <Option key={id} value={id}>
    //       {displayName || email || phoneNumber || id}
    //     </Option>
    //   ))}
    // </Select>
  );
}
