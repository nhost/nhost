import { ControlledAutocomplete } from '@/components/form/ControlledAutocomplete';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
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

  const autocompleteOptions = data?.users.map(
    ({ id, displayName, email, phoneNumber }) => {
      return {
        label: displayName || email || phoneNumber || id,
        value: id,
      };
    },
  );

  return (
    <ControlledAutocomplete
      id="user-select"
      name="user-select"
      autoHighlight
      isOptionEqualToValue={() => false}
      filterOptions={(options, { inputValue }) => {
        const inputValueLower = inputValue.toLowerCase();
        const matched = [];
        const otherOptions = [];

        options.forEach((option) => {
          const optionLabelLower = option.label.toLowerCase();

          if (optionLabelLower.startsWith(inputValueLower)) {
            matched.push(option);
          } else {
            otherOptions.push(option);
          }
        });

        const result = [...matched, ...otherOptions];

        return result;
      }}
      fullWidth
      className="col-span-4"
      options={autocompleteOptions}
      showCustomOption="auto"
      customOptionLabel={(value) => `Make : "${value}"`}
    />
  );

  return (
    <Select
      {...props}
      id="user-select"
      label="Make Request As"
      hideEmptyHelperText
      defaultValue="admin"
      slotProps={{ root: { className: 'truncate' } }}
      onChange={(_event, userId) => {
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
    >
      <Option value="admin">Admin</Option>

      {data?.users.map(({ id, displayName, email, phoneNumber }) => (
        <Option key={id} value={id}>
          {displayName || email || phoneNumber || id}
        </Option>
      ))}
    </Select>
  );
}
