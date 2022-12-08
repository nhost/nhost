import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import type { Role } from '@/types/application';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { useRemoteAppGetUsersQuery } from '@/utils/__generated__/graphql';
import { Fragment, useState } from 'react';

export interface RoleSettingsFormValues {
  /**
   * Default role.
   */
  authUserDefaultRole: string;
  /**
   * Allowed roles for the project.
   */
  authUserDefaultAllowedRoles: Role[];
}

export default function UsersBody() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  // const { openDialog, openAlertDialog } = useDialog();
  const [searchQuery] = useState('');
  const [currentPage] = useState(1);

  const limit = 20;

  const offset = currentPage - 1;

  const { data, error, loading } = useRemoteAppGetUsersQuery({
    variables: {
      where: {
        _or: [
          {
            displayName: {
              _like: `%${searchQuery}%`,
            },
          },
          {
            email: {
              _like: `%${searchQuery}%`,
            },
          },
        ],
      },
      limit,
      offset: offset * limit,
    },
    skip:
      !currentApplication?.subdomain &&
      !currentApplication?.hasuraGraphqlAdminSecret,
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  return (
    <div className="grid grid-flow-row gap-2">
      <div className="grid grid-cols-4 gap-2 px-4 py-3 border-gray-200 lg:grid-cols-4 border-b-1">
        <Text className="font-medium">Name</Text>
        <Text className="font-medium">Signed up at</Text>
        <Text className="font-medium">Last Seen</Text>
        <Text className="font-medium">Sign In Methods</Text>
      </div>
      <div className="grid grid-flow-row gap-2">
        <List>
          {data.users.map((user) => (
            <Fragment key={user.id}>
              <ListItem.Root
                className="grid grid-cols-4 gap-2 px-4 lg:grid-cols-4"
                secondaryAction={
                  <Dropdown.Root>
                    <Dropdown.Trigger
                      asChild
                      hideChevron
                      className="absolute -translate-y-1/2 right-4 top-1/2"
                    >
                      <IconButton variant="borderless" color="secondary">
                        <DotsVerticalIcon />
                      </IconButton>
                    </Dropdown.Trigger>

                    <Dropdown.Content
                      menu
                      PaperProps={{ className: 'w-32' }}
                      anchorOrigin={{
                        vertical: 'bottom',
                        horizontal: 'right',
                      }}
                      transformOrigin={{
                        vertical: 'top',
                        horizontal: 'right',
                      }}
                    >
                      <Dropdown.Item>
                        <Text className="font-medium">Set as Default</Text>
                      </Dropdown.Item>

                      <Divider component="li" />

                      <Dropdown.Item>
                        <Text className="font-medium">Edit</Text>
                      </Dropdown.Item>

                      <Divider component="li" />
                    </Dropdown.Content>
                  </Dropdown.Root>
                }
              >
                <ListItem.Text className="grid grid-flow-col grid-cols-2 gap-x-2">
                  <div className="">
                    <div>{user.displayName}</div>
                    <div>{user.displayName}</div>
                  </div>
                </ListItem.Text>
                <ListItem.Text>{user.displayName}</ListItem.Text>
                <ListItem.Text>
                  {user.displayName ||
                    user.email ||
                    user.phoneNumber ||
                    user.id}
                </ListItem.Text>
                <ListItem.Text>
                  {user.displayName ||
                    user.email ||
                    user.phoneNumber ||
                    user.id}
                </ListItem.Text>
              </ListItem.Root>

              <Divider component="li" />
            </Fragment>
          ))}
        </List>
      </div>
    </div>
  );
}
