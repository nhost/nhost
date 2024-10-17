import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
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
import { Button, buttonVariants } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  Organization_Members_Role_Enum,
  useDeleteOrganizationMemberInviteMutation,
  useGetOrganizationInvitesLazyQuery,
  useUpdateOrganizationMemberInviteMutation,
  type GetOrganizationInvitesQuery,
} from '@/utils/__generated__/graphql';
import { z } from 'zod';

import { Ellipsis } from 'lucide-react';

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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';

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
  const { org } = useCurrentOrg();
  const [deleting, setDeleting] = useState(false);
  const [deleteInvite] = useDeleteOrganizationMemberInviteMutation();
  const [dropDownOpen, setDropDownOpen] = useState(false);
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
      <div className="flex w-full flex-row items-center justify-between">
        <span className="text-sm text-foreground">{invite.email}</span>

        <div className="flex flex-row items-center gap-4 text-foreground">
          <span className="font-medium">{invite.role}</span>

          <DropdownMenu open={dropDownOpen} onOpenChange={setDropDownOpen}>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" disabled={!isAdmin}>
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={-5}>
              <DropdownMenuItem
                onSelect={() => {
                  setDropDownOpen(false);
                  form.reset({ email: invite.email, role: invite.role });
                  setUpdateRoleDialogOpen(true);
                }}
              >
                Update role
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setDropDownOpen(false);
                  setConfirmDeleteInviteDialogOpen(true);
                }}
              >
                Delete invite
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog
        open={confirmDeleteInviteDialogOpen}
        onOpenChange={setConfirmDeleteInviteDialogOpen}
      >
        <AlertDialogContent className="text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will delete the invite.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteInvite}
              className={buttonVariants({ variant: 'destructive' })}
              disabled={deleting}
            >
              {deleting ? <ActivityIndicator /> : 'Delete'}
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
        <DialogContent className="text-foreground sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)}>
              <DialogHeader className="mb-4">
                <DialogTitle>Update invite</DialogTitle>
                <DialogDescription>
                  This will affect their permissions and access within the
                  organization.
                </DialogDescription>
              </DialogHeader>

              <div className="mb-4 flex flex-col gap-4">
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
                      <Select
                        onValueChange={field.onChange}
                        defaultValue={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a verified email to display" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {Object.entries(Organization_Members_Role_Enum).map(
                            (role) => (
                              <SelectItem key={role[0]} value={role[1]}>
                                {role[1]}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button
                  variant="secondary"
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
