import { useDialog } from '@/components/common/DialogProvider';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import IconButton from '@/ui/v2/IconButton';
import DotsVerticalIcon from '@/ui/v2/icons/DotsVerticalIcon';
import PlusIcon from '@/ui/v2/icons/PlusIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import { useGetSecretsQuery } from '@/utils/__generated__/graphql';
import type { ReactElement } from 'react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';

export default function SecretsPage() {
  const { openDialog } = useDialog();
  const { currentApplication } = useCurrentWorkspaceAndApplication();

  const { data, loading, error } = useGetSecretsQuery({
    variables: { appId: currentApplication?.id },
  });

  if (loading) {
    return <ActivityIndicator delay={1000} label="Loading secrets..." />;
  }

  if (error) {
    throw error;
  }

  function handleOpenCreator() {
    openDialog('CREATE_SECRET', {
      title: 'Create Secret',
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleOpenEditor(value: any) {
    console.log(value);
  }

  function handleConfirmDelete(value: any) {
    console.log(value);
  }

  const secrets = data?.appSecrets || [];

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-6 bg-transparent"
      rootClassName="bg-transparent"
    >
      <SettingsContainer
        title="Secrets"
        description="Secrets are key-value pairs configured outside your source code. TBD."
        docsLink="https://docs.nhost.io/platform/environment-variables"
        docsTitle="Secrets"
        rootClassName="gap-0"
        className={twMerge('my-2 px-0', secrets.length === 0 && 'gap-2')}
        slotProps={{ submitButton: { className: 'hidden' } }}
      >
        <Box className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3">
          <Text className="font-medium">Secret Name</Text>
        </Box>

        <Box className="grid grid-flow-row gap-2">
          {secrets.length > 0 && (
            <List>
              {secrets.map((secret, index) => (
                <Fragment key={secret.name}>
                  <ListItem.Root
                    className="grid grid-cols-2 gap-2 px-4"
                    secondaryAction={
                      <Dropdown.Root>
                        <Dropdown.Trigger
                          asChild
                          hideChevron
                          className="absolute right-4 top-1/2 -translate-y-1/2"
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
                          <Dropdown.Item
                            onClick={() => handleOpenEditor(secret)}
                          >
                            <Text className="font-medium">Edit</Text>
                          </Dropdown.Item>

                          <Divider component="li" />

                          <Dropdown.Item
                            onClick={() => handleConfirmDelete(secret)}
                          >
                            <Text
                              className="font-medium"
                              sx={{
                                color: (theme) => theme.palette.error.main,
                              }}
                            >
                              Delete
                            </Text>
                          </Dropdown.Item>
                        </Dropdown.Content>
                      </Dropdown.Root>
                    }
                  >
                    <ListItem.Text className="truncate">
                      {secret.name}
                    </ListItem.Text>
                  </ListItem.Root>

                  <Divider
                    component="li"
                    className={twMerge(
                      index === secrets.length - 1 ? '!mt-4' : '!my-4',
                    )}
                  />
                </Fragment>
              ))}
            </List>
          )}

          <Button
            className="mx-4 justify-self-start"
            variant="borderless"
            startIcon={<PlusIcon />}
            onClick={handleOpenCreator}
          >
            Create Secret
          </Button>
        </Box>
      </SettingsContainer>
    </Container>
  );
}

SecretsPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
