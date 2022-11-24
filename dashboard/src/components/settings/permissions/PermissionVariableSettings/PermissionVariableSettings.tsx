import Form from '@/components/common/Form';
import SettingsContainer from '@/components/settings/SettingsContainer';
import useCustomClaims from '@/hooks/useCustomClaims';
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
import { Fragment } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { twMerge } from 'tailwind-merge';

export interface PermissionVariableSettingsFormValues {
  /**
   * Permission variables.
   */
  authJwtCustomClaims: string;
}

export default function PermissionVariableSettings() {
  const { data: customClaims, loading } = useCustomClaims();

  const form = useForm();

  if (loading) {
    return (
      <ActivityIndicator delay={1000} label="Loading permission variables..." />
    );
  }

  const { formState } = form;

  function handleOpenCreator() {}

  function handleOpenEditor(originalVariableName: string) {}

  function handleConfirmDelete(originalVariableName: string) {}

  async function handleSubmit(values: PermissionVariableSettingsFormValues) {
    console.log(values);
  }

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleSubmit}>
        <SettingsContainer
          title="Permission Variables"
          description="These variables can be used to defined PermissionVariable. They are sent from client to the GraphQL API, and must match the specified property of a queried user."
          slotProps={{
            submitButtonProps: {
              loading: formState.isSubmitting,
              disabled: !formState.isValid || !formState.isDirty,
            },
          }}
          className="px-0"
        >
          <div className="grid grid-cols-2 border-b-1 border-gray-200 px-4 py-3">
            <Text className="font-medium">Field name</Text>
            <Text className="font-medium">Path</Text>
          </div>

          <List>
            {customClaims.map((customClaim, index) => (
              <Fragment key={customClaim.key}>
                <ListItem.Root
                  className="px-4 grid grid-cols-2"
                  secondaryAction={
                    <Dropdown.Root>
                      <Tooltip
                        title={
                          customClaim.isSystemClaim
                            ? "You can't edit system variables"
                            : ''
                        }
                        placement="right"
                        disableHoverListener={!customClaim.isSystemClaim}
                        hasDisabledChildren={customClaim.isSystemClaim}
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        <Dropdown.Trigger asChild hideChevron>
                          <IconButton
                            variant="borderless"
                            color="secondary"
                            disabled={customClaim.isSystemClaim}
                          >
                            <DotsVerticalIcon />
                          </IconButton>
                        </Dropdown.Trigger>
                      </Tooltip>

                      <Dropdown.Content
                        menu
                        PaperProps={{ className: 'w-[160px]' }}
                        anchorOrigin={{
                          vertical: 'bottom',
                          horizontal: 'right',
                        }}
                        transformOrigin={{
                          vertical: 'top',
                          horizontal: 'right',
                        }}
                      >
                        <Dropdown.Item
                          onClick={() => handleOpenEditor(customClaim.key)}
                        >
                          <Text className="font-medium">Edit Variable</Text>
                        </Dropdown.Item>

                        <Divider component="li" />

                        <Dropdown.Item
                          onClick={() => handleConfirmDelete(customClaim.key)}
                        >
                          <Text
                            className="font-medium"
                            sx={{ color: (theme) => theme.palette.error.main }}
                          >
                            Delete Variable
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Text
                    primary={customClaim.key}
                    secondary={
                      customClaim.isSystemClaim
                        ? 'System Variable'
                        : 'Custom Variable'
                    }
                  />

                  <Text>{customClaim.value}</Text>
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === customClaims.length - 1 ? '!mt-4' : '!my-4',
                  )}
                />
              </Fragment>
            ))}
          </List>

          <Button
            className="justify-self-start mx-4"
            variant="borderless"
            startIcon={<PlusIcon />}
            onClick={handleOpenCreator}
          >
            Create New Variable
          </Button>
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
