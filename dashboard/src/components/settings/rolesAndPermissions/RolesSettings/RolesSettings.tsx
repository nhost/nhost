import { useDialog } from '@/components/common/DialogProvider';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import Tooltip from '@/ui/v2/Tooltip';
import { useGetRolesQuery } from '@/utils/__generated__/graphql';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

function getUserRoles(roles?: string) {
  if (!roles) {
    return [];
  }

  return roles.split(',').map((role, index) => ({
    id: `${index}-${role}`,
    name: role.trim(),
    isSystemRole: role === 'user' || role === 'me',
  }));
}

export default function RolesSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog } = useDialog();
  const { data, loading, error } = useGetRolesQuery({
    variables: { id: currentApplication?.id },
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading user roles..." />;
  }

  if (error) {
    throw error;
  }

  const userRoles = getUserRoles(data?.app?.authUserDefaultAllowedRoles);

  return (
    <SettingsContainer
      title="Roles"
      description="Add and change permissions for different roles."
      className="px-0"
    >
      <div className="border-b-1 border-gray-200 px-4 py-3">
        <Text className="font-medium">Name</Text>
      </div>

      <List>
        {userRoles.map((role, index) => (
          <Fragment key={role.id}>
            <ListItem.Root
              secondaryAction={
                <Dropdown.Root>
                  <Tooltip
                    title="You can't edit system roles"
                    placement="right"
                    disableHoverListener={!role.isSystemRole}
                    hasDisabledChildren={role.isSystemRole}
                    className="absolute right-4 top-1/2 -translate-y-1/2"
                  >
                    <Dropdown.Trigger asChild hideChevron>
                      <IconButton
                        variant="borderless"
                        color="secondary"
                        disabled={role.isSystemRole}
                      >
                        <DotsVerticalIcon />
                      </IconButton>
                    </Dropdown.Trigger>
                  </Tooltip>

                  <Dropdown.Content
                    menu
                    PaperProps={{ className: 'w-[160px]' }}
                    anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
                    transformOrigin={{ vertical: 'top', horizontal: 'right' }}
                  >
                    <Dropdown.Item
                      onClick={() =>
                        openDialog('EDIT_ROLE', {
                          title: (
                            <span className="grid grid-flow-row">
                              <span>Create a New Role</span>

                              <Text variant="subtitle1" component="span">
                                Enter the name for the role below.
                              </Text>
                            </span>
                          ),
                          props: { PaperProps: { className: 'max-w-sm' } },
                          payload: { originalRole: role.name },
                        })
                      }
                    >
                      <Text className="font-medium">Edit Role</Text>
                    </Dropdown.Item>
                    <Divider component="li" />
                    <Dropdown.Item>
                      <Text
                        className="font-medium"
                        sx={{ color: (theme) => theme.palette.error.main }}
                      >
                        Delete Role
                      </Text>
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Root>
              }
              className="px-4 rounded-none"
            >
              <ListItem.Text
                primary={role.name}
                secondary={role.isSystemRole ? 'System Role' : 'Custom Role'}
              />
            </ListItem.Root>

            <Divider
              component="li"
              className={twMerge(
                index === userRoles.length - 1 ? '!mt-4' : '!my-4',
              )}
            />
          </Fragment>
        ))}
      </List>

      <Button
        className="justify-self-start mx-4"
        variant="borderless"
        startIcon={<PlusIcon />}
        onClick={() =>
          openDialog('CREATE_ROLE', {
            title: (
              <span className="grid grid-flow-row">
                <span>Create a New Role</span>

                <Text variant="subtitle1" component="span">
                  Enter the name for the role below.
                </Text>
              </span>
            ),
            props: { PaperProps: { className: 'max-w-sm' } },
          })
        }
      >
        Create New Role
      </Button>
    </SettingsContainer>
  );
}
