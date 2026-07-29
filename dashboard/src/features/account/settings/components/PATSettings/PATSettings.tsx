import {
  EllipsisVertical as DotsVerticalIcon,
  PlusIcon,
  TriangleAlert as WarningIcon,
} from 'lucide-react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';
import { useDialog } from '@/components/common/DialogProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Box } from '@/components/ui/v2/Box';
import { Divider } from '@/components/ui/v2/Divider';
import { IconButton } from '@/components/ui/v2/IconButton';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { CreatePATForm } from '@/features/account/settings/components/CreatePATForm';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetPersonalAccessTokensDocument,
  useDeletePersonalAccessTokenMutation,
  useGetPersonalAccessTokensQuery,
} from '@/generated/graphql';

export default function PATSettings() {
  const { openDialog, openAlertDialog } = useDialog();

  const { data, error } = useGetPersonalAccessTokensQuery();

  const [deletePAT] = useDeletePersonalAccessTokenMutation({
    refetchQueries: [GetPersonalAccessTokensDocument],
  });

  const availablePersonalAccessTokens =
    data?.personalAccessTokens.map((pat) => ({
      id: pat.id,
      name: pat.metadata?.name || 'n/a',
      expiresAt: pat.expiresAt,
      createdAt: pat.createdAt,
      metadata: pat.metadata,
    })) || [];

  function handleOpenCreator() {
    openDialog({
      title: 'Create Personal Access Token',
      component: <CreatePATForm />,
      props: {
        maxWidth: 'md',
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-md' },
      },
    });
  }

  async function handleDeletePAT({
    id,
  }: (typeof availablePersonalAccessTokens)[0]) {
    await execPromiseWithErrorToast(
      () => deletePAT({ variables: { patId: id } }),
      {
        loadingMessage: 'Deleting personal access token...',
        successMessage: 'Personal access token has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the personal access token.',
      },
    );
  }

  function handleConfirmDelete(
    originalPAT: (typeof availablePersonalAccessTokens)[0],
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
      <Box className="grid grid-cols-3 gap-2 border-b-1 py-3 pr-12 pl-4">
        <Text className="font-medium">Name</Text>
        <Text className="font-medium">Expires at</Text>
        <Text className="font-medium">Created at</Text>
      </Box>

      <Box className="grid grid-flow-row gap-2">
        {availablePersonalAccessTokens.length > 0 && (
          <List>
            {availablePersonalAccessTokens.map((pat, index) => {
              const tokenHasExpired = new Date(pat.expiresAt) < new Date();

              return (
                <Fragment key={pat.id}>
                  <ListItem.Root
                    className="grid grid-cols-3 gap-2 px-4 pr-12"
                    secondaryAction={
                      <DropdownMenu>
                        <DropdownMenuTrigger
                          asChild
                          className="absolute top-1/2 right-4 -translate-y-1/2"
                        >
                          <IconButton
                            variant="borderless"
                            color="secondary"
                            aria-label={`More options for ${pat.name}`}
                          >
                            <DotsVerticalIcon />
                          </IconButton>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-32 p-0">
                          <DropdownMenuItem
                            onClick={() => handleConfirmDelete(pat)}
                            className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                          >
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    }
                  >
                    <ListItem.Text
                      className="truncate"
                      color={tokenHasExpired ? 'warning' : 'primary'}
                    >
                      <span className="mr-2">{pat.name}</span>
                      {tokenHasExpired && (
                        <Tooltip title="This personal access token is expired.">
                          <WarningIcon className="h-4 w-4" />
                        </Tooltip>
                      )}
                    </ListItem.Text>

                    <Text
                      className="truncate"
                      color={tokenHasExpired ? 'warning' : 'primary'}
                    >
                      {new Date(pat.expiresAt).toLocaleDateString()}
                    </Text>

                    <Text
                      className="truncate"
                      color={tokenHasExpired ? 'warning' : 'primary'}
                    >
                      {new Date(pat.createdAt).toLocaleDateString()}
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
              );
            })}
          </List>
        )}

        <Button
          type="button"
          variant="ghost"
          className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
          onClick={handleOpenCreator}
        >
          <PlusIcon className="mr-2 h-4 w-4" />
          Create Personal Access Token
        </Button>
      </Box>
    </SettingsContainer>
  );
}
