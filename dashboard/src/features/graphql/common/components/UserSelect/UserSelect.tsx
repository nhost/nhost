import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { DEFAULT_ROLES } from '@/features/graphql/common/utils/constants';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { useHasuraAdminSecretMissingDialog } from '@/features/projects/common/hooks/useHasuraAdminSecretMissingDialog';
import {
  useRemoteAppGetUsersCustomQuery,
  type RemoteAppGetUsersCustomQuery,
} from '@/generated/project-graphql';
import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';

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
  const { currentProject } = useCurrentWorkspaceAndProject();
  const userApplicationClient = useRemoteApplicationGQLClient();
  const { data, loading, error } = useRemoteAppGetUsersCustomQuery({
    client: userApplicationClient,
    variables: { where: {}, limit: 250, offset: 0 },
    skip: !currentProject,
  });

  useHasuraAdminSecretMissingDialog(error as Error);

  if (loading) {
    return (
      <div className={props.className}>
        <ActivityIndicator label="Loading users..." delay={500} />
      </div>
    );
  }

  // TODO double check whether we should remove this or
  // try to filter out only the Hasura Admin Secret Key Missing
  // if (error) {
  //   throw error;
  // }

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
