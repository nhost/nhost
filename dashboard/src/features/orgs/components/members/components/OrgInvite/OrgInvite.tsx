import { zodResolver } from '@hookform/resolvers/zod';
import { formatDistance } from 'date-fns';
import { Loader2, Mail, Trash2, UserCog } from 'lucide-react';
import { IconButton } from '@/components/ui/v3/icon-button';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { Badge } from '@/components/ui/v3/badge';
import { Button, buttonVariants } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { Input } from '@/components/ui/v3/input';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { RoleSelector } from '@/features/orgs/components/members/components/RoleSelector';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import {
  type GetOrganizationInvitesQuery,
  Organization_Members_Role_Enum,
  useDeleteOrganizationMemberInviteMutation,
  useGetOrganizationInvitesLazyQuery,
  useUpdateOrganizationMemberInviteMutation,
} from '@/generated/graphql';

type Invite = GetOrganizationInvitesQuery['organizationMemberInvites'][0];

interface InviteProps {
  invite: Invite;
  isAdmin: boolean;
}

const sendInviteFormSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(Organization_Members_Role_Enum),
});

export default function OrgInvite({ invite, isAdmin }: InviteProps) {
  const {
    org,
    org: { name: orgName } = {},
  } = useCurrentOrg();
  const [deleting, setDeleting] = useState(false);
  const [deleteInvite] = useDeleteOrganizationMemberInviteMutation();
  const [confirmDeleteInviteDialogOpen, setConfirmDeleteInviteDialogOpen] =
    useState(false);

  const [updateRoleDialogOpen, setUpdateRoleDialogOpen] = useState(false);

  const [, { refetch }] = useGetOrganizationInvitesLazyQuery({
    variables: { organizationId: org?.id },
  });

  const [updateInvite] = useUpdateOrganizationMemberInviteMutation();

  const form = useForm<z.infer<typeof sendInviteFormSchema>>({
    resolver: zodResolver(sendInviteFormSchema),
    defaultValues: {
      email: invite.email,
      role: invite.role,
    },
  });

  const onUpdateSubmit = async (
    values: z.infer<typeof sendInviteFormSchema>,
  ) => {
    const { role } = values;

    await execPromiseWithErrorToast(
      async () => {
        await updateInvite({
          variables: {
            inviteId: invite.id,
            role,
          },
        });

        form.reset();
        refetch();
        setUpdateRoleDialogOpen(false);
      },
      {
        loadingMessage: 'Updating invite...',
        successMessage: `Invite updated.`,
        errorMessage: `An error occured while updating the invite! Please try again.`,
      },
    );
  };

  const handleDismissDialog = () => {
    form.reset();
    setUpdateRoleDialogOpen(false);
  };

  const handleDeleteInvite = async () => {
    setDeleting(true);

    await execPromiseWithErrorToast(
      async () => {
        await deleteInvite({
          variables: {
            inviteId: invite.id,
          },
        });

        refetch();
        setDeleting(false);
        setConfirmDeleteInviteDialogOpen(false);
      },
      {
        loadingMessage: 'Deleting invite...',
        successMessage: `Invite deleted`,
        errorMessage: `An error occured while deleting the invite! Please try again.`,
      },
    );
  };

  return (
    <>
      <div className="flex w-full flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 flex-row items-center gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-neutral-200 dark:bg-muted">
            <Mail className="h-4 w-4 text-neutral-700 dark:text-muted-foreground" />
          </div>

          <div className="flex min-w-0 flex-col">
            <span className="truncate font-medium">{invite.email}</span>
            <span className="truncate text-muted-foreground text-sm">
              Invited{' '}
              {formatDistance(new Date(invite.createdAt), new Date(), {
                addSuffix: true,
              })}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-4 sm:gap-6">
          <Badge
            variant="outline"
            className={cn(
              'px-2 py-0.5 font-medium text-[10px]',
              invite.role === Organization_Members_Role_Enum.Admin &&
                'border-primary text-primary-main',
            )}
          >
            {invite.role}
          </Badge>

          <div className="flex flex-row items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex',
                    !isAdmin && 'cursor-not-allowed',
                  )}
                >
                  <IconButton
                    icon={UserCog}
                    aria-label="Update role"
                    disabled={!isAdmin}
                    onClick={() => {
                      form.reset({ email: invite.email, role: invite.role });
                      setUpdateRoleDialogOpen(true);
                    }}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isAdmin ? 'Update role' : 'Only admins can update invites.'}
              </TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex',
                    !isAdmin && 'cursor-not-allowed',
                  )}
                >
                  <IconButton
                    icon={Trash2}
                    aria-label="Delete invite"
                    disabled={!isAdmin}
                    onClick={() => setConfirmDeleteInviteDialogOpen(true)}
                  />
                </span>
              </TooltipTrigger>
              <TooltipContent>
                {isAdmin ? 'Delete invite' : 'Only admins can delete invites.'}
              </TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmDeleteInviteDialogOpen}
        onOpenChange={setConfirmDeleteInviteDialogOpen}
      >
        <AlertDialogContent className="text-foreground p-12">
          <AlertDialogHeader className="mb-8">
            <AlertDialogTitle>Delete invite?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete the invite sent to{' '}
              <strong className="font-semibold text-foreground">
                {invite.email}
              </strong>
              . They won&apos;t be able to join {orgName} using this invite
              anymore.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvite}
              className={buttonVariants({ variant: 'destructive' })}
              disabled={deleting}
            >
              {deleting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                'Delete invite'
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={updateRoleDialogOpen}
        onOpenChange={(value) => {
          form.reset();
          setUpdateRoleDialogOpen(value);
        }}
      >
        <DialogContent className="text-foreground p-12 sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)}>
              <DialogHeader className="mb-4">
                <DialogTitle>Update invite</DialogTitle>
                <DialogDescription>
                  This will affect their permissions and access within the
                  organization.
                </DialogDescription>
              </DialogHeader>

              <div className="mb-8 flex flex-col gap-4">
                <FormField
                  control={form.control}
                  name="email"
                  disabled
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input
                          {...field}
                          type="email"
                          placeholder="name@company.com"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Role</FormLabel>
                      <FormControl>
                        <RoleSelector
                          value={field.value}
                          onChange={field.onChange}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="outline-emboss"
                  type="button"
                  onClick={handleDismissDialog}
                >
                  Cancel
                </Button>
                <Button type="submit">Update</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
