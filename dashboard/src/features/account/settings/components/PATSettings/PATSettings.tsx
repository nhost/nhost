import {
  EllipsisVertical as DotsVerticalIcon,
  PlusIcon,
  TriangleAlert as WarningIcon,
} from 'lucide-react';
import { useState } from 'react';
import {
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { AccountSettingsCard } from '@/features/account/settings/components/AccountSettingsCard';
import { CreatePATForm } from '@/features/account/settings/components/CreatePATForm';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetPersonalAccessTokensDocument,
  useDeletePersonalAccessTokenMutation,
  useGetPersonalAccessTokensQuery,
} from '@/generated/graphql';
import { cn } from '@/lib/utils';

type PersonalAccessToken = {
  id: string;
  name: string;
  expiresAt: string;
  createdAt: string;
};

export default function PATSettings() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [tokenPendingDeletion, setTokenPendingDeletion] =
    useState<PersonalAccessToken | null>(null);
  const [isDeletingToken, setIsDeletingToken] = useState(false);

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
    })) || [];

  async function handleDeletePAT({ id }: PersonalAccessToken) {
    setIsDeletingToken(true);

    try {
      const result = await execPromiseWithErrorToast(
        () => deletePAT({ variables: { patId: id } }),
        {
          loadingMessage: 'Deleting personal access token...',
          successMessage:
            'Personal access token has been deleted successfully.',
          errorMessage:
            'An error occurred while deleting the personal access token.',
        },
      );

      if (result) {
        setTokenPendingDeletion(null);
      }
    } finally {
      setIsDeletingToken(false);
    }
  }

  if (error) {
    throw error;
  }

  return (
    <AccountSettingsCard className="gap-0 pb-0">
      <SettingsCardHeader
        title="Personal Access Tokens"
        description="Personal access tokens are unique authorization keys that grant individuals access to specific resources and services within a system or platform."
      />

      <SettingsCardContent
        className={cn(
          'my-2 px-0',
          availablePersonalAccessTokens.length === 0 && 'gap-2',
        )}
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Expires at</TableHead>
              <TableHead>Created at</TableHead>
              <TableHead className="w-12" />
            </TableRow>
          </TableHeader>
          <TableBody>
            {availablePersonalAccessTokens.map((pat) => {
              const tokenHasExpired = new Date(pat.expiresAt) < new Date();
              const textClassName = cn(
                'truncate',
                tokenHasExpired && 'text-amber-600',
              );

              return (
                <TableRow key={pat.id}>
                  <TableCell className={textClassName}>
                    <span className="mr-2">{pat.name}</span>
                    {tokenHasExpired && (
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <WarningIcon className="inline h-4 w-4" />
                        </TooltipTrigger>
                        <TooltipContent>
                          This personal access token is expired.
                        </TooltipContent>
                      </Tooltip>
                    )}
                  </TableCell>
                  <TableCell className={textClassName}>
                    {new Date(pat.expiresAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className={textClassName}>
                    {new Date(pat.createdAt).toLocaleDateString()}
                  </TableCell>
                  <TableCell className="text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          aria-label={`More options for ${pat.name}`}
                        >
                          <DotsVerticalIcon className="h-4 w-4" />
                        </Button>
                      </DropdownMenuTrigger>

                      <DropdownMenuContent align="end" className="w-32 p-0">
                        <DropdownMenuItem
                          onClick={() => setTokenPendingDeletion(pat)}
                          className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                        >
                          <span>Delete</span>
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>

        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
            >
              <PlusIcon className="mr-2 h-4 w-4" />
              Create Personal Access Token
            </Button>
          </DialogTrigger>
          <DialogContent className="z-[9999] max-w-md text-foreground">
            <DialogHeader>
              <DialogTitle>Create Personal Access Token</DialogTitle>
              <DialogDescription>
                Create a token to authenticate with Nhost services.
              </DialogDescription>
            </DialogHeader>
            <CreatePATForm onCancel={() => setCreateDialogOpen(false)} />
          </DialogContent>
        </Dialog>
      </SettingsCardContent>

      <AlertDialog
        open={!!tokenPendingDeletion}
        onOpenChange={(open) => {
          if (!open) {
            setTokenPendingDeletion(null);
          }
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Personal Access Token</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete this personal access token? Any
              applications or scripts using this token will no longer be able to
              access the API. You cannot undo this action.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeletingToken}>
              Cancel
            </AlertDialogCancel>
            <ButtonWithLoading
              type="button"
              variant="destructive"
              loading={isDeletingToken}
              onClick={() => {
                if (tokenPendingDeletion) {
                  handleDeletePAT(tokenPendingDeletion);
                }
              }}
            >
              Delete
            </ButtonWithLoading>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AccountSettingsCard>
  );
}
