import { formatDistanceToNow } from 'date-fns';
import {
  Ellipsis as DotsHorizontalIcon,
  Trash2 as TrashIcon,
  UserIcon,
} from 'lucide-react';
import { Fragment } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { Separator } from '@/components/ui/v3/separator';
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
    <ul>
      {clients.map((client) => {
        const isConfidential = !!client.clientSecretHash;
        const description = client.metadata?.description as string | undefined;

        return (
          <Fragment key={client.clientId}>
            <li className="relative">
              <button
                type="button"
                onClick={() => handleEdit(client)}
                aria-label={`View ${client.clientId}`}
                className="grid h-[64px] w-full grid-cols-1 py-2.5 text-left md:grid-cols-8"
              >
                <div className="col-span-2 min-w-0">
                  <p className="truncate font-mono text-foreground text-sm">
                    {client.clientId}
                  </p>
                  {description && (
                    <p className="truncate text-muted-foreground">
                      {description}
                    </p>
                  )}
                </div>
                <p className="hidden px-2 font-normal text-foreground md:block">
                  {isConfidential ? 'Confidential' : 'Public'}
                </p>
                <p className="hidden px-2 font-normal text-foreground md:block">
                  {formatDistanceToNow(new Date(client.createdAt), {
                    addSuffix: true,
                  })}
                </p>
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
                    <p className="font-normal text-foreground">-</p>
                  )}
                </div>
              </button>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="absolute top-1/2 right-2 h-8 w-8 -translate-y-1/2"
                    aria-label={`More options for ${client.clientId}`}
                  >
                    <DotsHorizontalIcon className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>

                <DropdownMenuContent align="end" className="w-52 p-0">
                  <DropdownMenuItem
                    onClick={() => handleEdit(client)}
                    className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                  >
                    <UserIcon className="h-4 w-4" />
                    <span>Edit Client</span>
                  </DropdownMenuItem>

                  <DropdownMenuItem
                    onClick={() => handleDelete(client)}
                    className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                  >
                    <TrashIcon className="h-4 w-4" />
                    <span>Delete Client</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </li>
            <Separator />
          </Fragment>
        );
      })}
    </ul>
  );
}
