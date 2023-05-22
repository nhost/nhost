import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/settings/SettingsContainer';
import { useUI } from '@/context/UIContext';
import { CreatePATForm } from '@/features/account/settings/components/CreatePATForm';
import { ActivityIndicator } from '@/ui/v2/ActivityIndicator';
import { Box } from '@/ui/v2/Box';
import { Button } from '@/ui/v2/Button';
import { Divider } from '@/ui/v2/Divider';
import { Dropdown } from '@/ui/v2/Dropdown';
import { IconButton } from '@/ui/v2/IconButton';
import { List } from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import { Text } from '@/ui/v2/Text';
import { DotsVerticalIcon } from '@/ui/v2/icons/DotsVerticalIcon';
import { PlusIcon } from '@/ui/v2/icons/PlusIcon';
import {
  GetPersonalAccessTokensDocument,
  useDeletePersonalAccessTokenMutation,
  useGetPersonalAccessTokensQuery,
} from '@/utils/__generated__/graphql';
import { getServerError } from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { Fragment } from 'react';
import { toast } from 'react-hot-toast';
import { twMerge } from 'tailwind-merge';

export default function PATSettings() {
  const { maintenanceActive } = useUI();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, loading, error } = useGetPersonalAccessTokensQuery({
    fetchPolicy: 'cache-only',
  });

  const [deletePAT] = useDeletePersonalAccessTokenMutation({
    refetchQueries: [GetPersonalAccessTokensDocument],
  });

  const availablePersonalAccessTokens =
    data?.personalAccessTokens.map((pat) => ({
      id: pat.id,
      name: pat.metadata?.name || 'n/a',
      expiresAt: pat.expiresAt,
    })) || [];

  function handleOpenCreator() {
    openDialog({
      title: 'Create Personal Access Token',
      component: <CreatePATForm />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  async function handleDeletePAT({
    id,
  }: typeof availablePersonalAccessTokens[0]) {
    const deletePATPromise = deletePAT({ variables: { patId: id } });

    try {
      await toast.promise(
        deletePATPromise,
        {
          loading: 'Deleting personal access token...',
          success: 'Personal access token has been deleted successfully.',
          error: getServerError(
            'An error occurred while deleting the personal access token.',
          ),
        },
        getToastStyleProps(),
      );
    } catch {
      // Note: The toast will handle the error.
    }
  }

  function handleConfirmDelete(
    originalPAT: typeof availablePersonalAccessTokens[0],
  ) {
    openAlertDialog({
      title: 'Delete Personal Access Token',
      payload: (
        <Text>
          Are you sure you want to delete this personal access token? Any
          applications or scripts using this token will no longer be able to
          access the API. You cannot undo this action.
        </Text>
      ),
      props: {
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        onPrimaryAction: () => handleDeletePAT(originalPAT),
      },
    });
  }

  if (!data && loading) {
    return (
      <ActivityIndicator
        delay={1000}
        label="Loading personal access tokens..."
      />
    );
  }

  if (error) {
    throw error;
  }

  return (
    <SettingsContainer
      title="Personal Access Tokens"
      description="Personal access tokens are unique authorization keys that grant individuals access to specific resources and services within a system or platform."
      rootClassName="gap-0 pb-0"
      className={twMerge(
        'my-2 px-0',
        availablePersonalAccessTokens.length === 0 && 'gap-2',
      )}
      slotProps={{
        submitButton: { className: 'hidden' },
        footer: { className: 'hidden' },
      }}
    >
      <Box className="grid grid-cols-2 gap-2 border-b-1 py-3 pl-4 pr-12 lg:grid-cols-3">
        <Text className="font-medium">Name</Text>
        <Text className="font-medium lg:col-span-2">Expires at</Text>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        {availablePersonalAccessTokens.length > 0 && (
          <List>
            {availablePersonalAccessTokens.map((pat, index) => (
              <Fragment key={pat.id}>
                <ListItem.Root
                  className="grid grid-cols-2 gap-2 px-4 pr-12 lg:grid-cols-3"
                  secondaryAction={
                    <Dropdown.Root>
                      <Dropdown.Trigger
                        asChild
                        hideChevron
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                      >
                        <IconButton
                          variant="borderless"
                          color="secondary"
                          disabled={maintenanceActive}
                          aria-label={`More options for ${pat.name}`}
                        >
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
                        <Dropdown.Item onClick={() => handleConfirmDelete(pat)}>
                          <Text className="font-medium" color="error">
                            Delete
                          </Text>
                        </Dropdown.Item>
                      </Dropdown.Content>
                    </Dropdown.Root>
                  }
                >
                  <ListItem.Text className="truncate">{pat.name}</ListItem.Text>

                  <Text className="truncate lg:col-span-2">
                    {new Date(pat.expiresAt).toLocaleDateString()}
                  </Text>
                </ListItem.Root>

                <Divider
                  component="li"
                  className={twMerge(
                    index === availablePersonalAccessTokens.length - 1
                      ? '!mt-4'
                      : '!my-4',
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
          disabled={maintenanceActive}
        >
          Create Personal Access Token
        </Button>
      </Box>
    </SettingsContainer>
  );
}
