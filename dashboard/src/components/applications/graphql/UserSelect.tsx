import { useRemoteApplicationGQLClient } from '@/hooks/useRemoteApplicationGQLClient';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Option from '@/ui/v2/Option';
import Select from '@/ui/v2/Select';
import type { RemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import { useRemoteAppGetUsersCustomQuery } from '@/utils/__generated__/graphql';
import { DEFAULT_ROLES } from './utils';

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

export function UserSelect({ onUserChange, ...props }: UserSelectProps) {
  const userApplicationClient = useRemoteApplicationGQLClient();
  const { data, loading, error } = useRemoteAppGetUsersCustomQuery({
    client: userApplicationClient,
    variables: { where: {}, limit: 250, offset: 0 },
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

  const { users } = data;

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

        const user: RemoteAppGetUsersCustomQuery['users'][0] = users.find(
          ({ id }) => id === userId,
        );

        const roles = user?.roles.map(({ role }) => role);

        onUserChange(user.id, roles);
      }}
    >
      <Option value="admin">Admin</Option>

      {users.map(({ id, displayName, email, phoneNumber }) => (
        <Option key={id} value={id}>
          {displayName || email || phoneNumber || id}
        </Option>
      ))}
    </Select>
  );
}
