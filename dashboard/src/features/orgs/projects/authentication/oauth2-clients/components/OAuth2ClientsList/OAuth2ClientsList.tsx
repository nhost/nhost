import { formatDistanceToNow } from 'date-fns';
import { Fragment } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Divider } from '@/components/ui/v2/Divider';
import { Dropdown } from '@/components/ui/v2/Dropdown';
import { IconButton } from '@/components/ui/v2/IconButton';
import { DotsHorizontalIcon } from '@/components/ui/v2/icons/DotsHorizontalIcon';
import { TrashIcon } from '@/components/ui/v2/icons/TrashIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { Badge } from '@/components/ui/v3/badge';
import { useRemoteApplicationGQLClient } from '@/features/orgs/hooks/useRemoteApplicationGQLClient';
import { EditOAuth2ClientForm } from '@/features/orgs/projects/authentication/oauth2-clients/components/EditOAuth2ClientForm';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { GetOAuth2ClientsQuery } from '@/generated/graphql';
import {
  GetOAuth2ClientsDocument,
  useDeleteOAuth2ClientMutation,
} from '@/generated/graphql';

type OAuth2Client = GetOAuth2ClientsQuery['authOauth2Clients'][number];

interface OAuth2ClientsListProps {
  clients: OAuth2Client[];
  onRefetch: () => Promise<unknown>;
}

export default function OAuth2ClientsList({
  clients,
  onRefetch,
}: OAuth2ClientsListProps) {
  const { openDrawer, openAlertDialog } = useDialog();
  const remoteProjectGQLClient = useRemoteApplicationGQLClient();

  const [deleteOAuth2Client] = useDeleteOAuth2ClientMutation({
    client: remoteProjectGQLClient,
    refetchQueries: [{ query: GetOAuth2ClientsDocument }],
  });

  function handleEdit(client: OAuth2Client) {
    openDrawer({
      title: 'Edit OAuth2 Client',
      component: <EditOAuth2ClientForm client={client} onSubmit={onRefetch} />,
    });
  }

  function handleDelete(client: OAuth2Client) {
    openAlertDialog({
      title: 'Delete OAuth2 Client',
      payload: (
        <span>
          Are you sure you want to delete the client{' '}
          <strong className="break-all font-mono text-sm">
            {client.clientId}
          </strong>
          ? This action cannot be undone.
        </span>
      ),
      props: {
        primaryButtonText: 'Delete',
        primaryButtonColor: 'error',
        onPrimaryAction: async () => {
          await execPromiseWithErrorToast(
            async () => {
              await deleteOAuth2Client({
                variables: { clientId: client.clientId },
              });
              await onRefetch();
            },
            {
              loadingMessage: 'Deleting OAuth2 client...',
              successMessage: 'OAuth2 client has been deleted successfully.',
              errorMessage:
                'An error occurred while deleting the OAuth2 client.',
            },
          );
        },
      },
    });
  }

  return (
    <List>
      {clients.map((client) => {
        const isConfidential = !!client.clientSecretHash;
        const description = client.metadata?.description as string | undefined;

        return (
          <Fragment key={client.id}>
            <ListItem.Root
              className="h-[64px] w-full"
              secondaryAction={
                <Dropdown.Root>
                  <Dropdown.Trigger asChild hideChevron>
                    <IconButton
                      variant="borderless"
                      color="secondary"
                      aria-label={`More options for ${client.clientId}`}
                    >
                      <DotsHorizontalIcon />
                    </IconButton>
                  </Dropdown.Trigger>

                  <Dropdown.Content
                    menu
                    PaperProps={{ className: 'w-52' }}
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
                      onClick={() => handleEdit(client)}
                      className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                    >
                      <UserIcon className="h-4 w-4" />
                      <Text className="font-medium">Edit Client</Text>
                    </Dropdown.Item>

                    <Divider component="li" />

                    <Dropdown.Item
                      onClick={() => handleDelete(client)}
                      className="grid grid-flow-col items-center gap-2 p-2 font-medium text-sm+"
                      sx={{ color: 'error.main' }}
                    >
                      <TrashIcon className="h-4 w-4" />
                      <Text className="font-medium" color="error">
                        Delete Client
                      </Text>
                    </Dropdown.Item>
                  </Dropdown.Content>
                </Dropdown.Root>
              }
            >
              <ListItem.Button
                className="grid h-full w-full grid-cols-1 py-2.5 md:grid-cols-8"
                onClick={() => handleEdit(client)}
                aria-label={`View ${client.clientId}`}
              >
                <div className="col-span-2 min-w-0">
                  <Text className="truncate font-mono text-sm">
                    {client.clientId}
                  </Text>
                  {description && (
                    <Text className="truncate font-normal" color="secondary">
                      {description}
                    </Text>
                  )}
                </div>
                <Text className="hidden px-2 font-normal md:block">
                  {isConfidential ? 'Confidential' : 'Public'}
                </Text>
                <Text className="hidden px-2 font-normal md:block">
                  {formatDistanceToNow(new Date(client.createdAt), {
                    addSuffix: true,
                  })}
                </Text>
                <div className="col-span-3 hidden flex-wrap gap-1 px-2 md:flex">
                  {(client.scopes ?? []).length > 0 ? (
                    client.scopes.map((scope) => (
                      <Badge
                        key={scope}
                        variant="outline"
                        className="px-2 py-0.5 text-xs"
                      >
                        {scope}
                      </Badge>
                    ))
                  ) : (
                    <Text className="font-normal">-</Text>
                  )}
                </div>
              </ListItem.Button>
            </ListItem.Root>
            <Divider />
          </Fragment>
        );
      })}
    </List>
  );
}
