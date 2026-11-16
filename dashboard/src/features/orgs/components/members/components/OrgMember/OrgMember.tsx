import { zodResolver } from '@hookform/resolvers/zod';
import { Trash2, UserCog } from 'lucide-react';
import { useRouter } from 'next/router';
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
import { Avatar } from '@/components/ui/v3/avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
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
import { RoleBadge } from '@/features/orgs/components/members/components/RoleBadge';
import { RoleSelector } from '@/features/orgs/components/members/components/RoleSelector';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  type GetOrganizationQuery,
  Organization_Members_Role_Enum,
  useDeleteOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { cn } from '@/lib/utils';
import { errorMessageIncludes } from '@/utils/databaseErrors';

type Member = GetOrganizationQuery['organizations']['0']['members'][0];

interface OrgMemberProps {
  member: Member;
  isAdmin: boolean;
}

const updateMemberRoleFormSchema = z.object({
  email: z.string().email().optional(),
  role: z.nativeEnum(Organization_Members_Role_Enum),
});

export default function OrgMember({ member, isAdmin }: OrgMemberProps) {
  const user = useUserData();
  const { push } = useRouter();
  const { refetch: refetchOrgs } = useOrgs();
  const {
    org: { plan: { isFree } = {}, name: orgName } = {},
    refetch: refetchCurrentOrg,
  } = useCurrentOrg();
  const [confirmRemoveMemberDialogOpen, setConfirmRemoveMemberDialogOpen] =
    useState(false);
  const [updateMemberRoleDialogOpen, setUpdateMemberRoleDialogOpen] =
    useState(false);

  const isSelf = user?.id === member.user.id;
  const canManage = (isAdmin || isSelf) && !isFree;
  const canUpdateRole = isAdmin && !isFree;

  const updateRoleTooltip = canUpdateRole
    ? 'Update role'
    : isFree
      ? 'Upgrade your plan to manage member roles.'
      : 'Only admins can update member roles.';

  const removeMemberTooltip = canManage
    ? 'Remove from organization'
    : isFree
      ? 'Upgrade your plan to manage members.'
      : 'Only admins can remove other members.';

  const [deleteMember] = useDeleteOrganizationMemberMutation({
    variables: {
      memberId: member.id,
    },
  });

  const handleRemoveMemberFromOrg = async () => {
    await execPromiseWithErrorToast(
      async () => {
        const isRemovingSelf = user?.id === member.user.id;
        await deleteMember();
        // TODO see if it makes sense to unify both of these
        await refetchCurrentOrg();
        await refetchOrgs();

        if (isRemovingSelf) {
          push('/');
        }
      },
      {
        loadingMessage: `Removing member...`,
        successMessage: `Member removed.`,
        errorMessage: (error) =>
          errorMessageIncludes(error, 'Cannot delete the last admin')
            ? 'Organizations must have at least one admin. Assign another admin before removing this member.'
            : `Failed to remove member! Please try again`,
      },
    );
  };

  const form = useForm<z.infer<typeof updateMemberRoleFormSchema>>({
    resolver: zodResolver(updateMemberRoleFormSchema),
    defaultValues: {
      email: member.user.email,
      role: member.role,
    },
  });

  const [updateMember] = useUpdateOrganizationMemberMutation();

  const onUpdateSubmit = async (
    values: z.infer<typeof updateMemberRoleFormSchema>,
  ) => {
    const { role } = values;
    const { id: memberId } = member;

    await execPromiseWithErrorToast(
      async () => {
        await updateMember({
          variables: {
            memberId,
            role,
          },
        });

        form.reset();
        await refetchCurrentOrg();
        setUpdateMemberRoleDialogOpen(false);
      },
      {
        loadingMessage: 'Updating member role...',
        successMessage: `Member role updated.`,
        errorMessage: (error) =>
          errorMessageIncludes(error, 'Cannot change the last admin')
            ? "Organizations must have at least one admin. Assign another admin before changing this member's role."
            : `An error occured while updating the member role! Please try again.`,
      },
    );
  };

  const handleDismissDialog = () => {
    form.reset();
    setUpdateMemberRoleDialogOpen(false);
  };

  return (
    <>
      <div className="flex w-full flex-row items-center justify-between gap-2">
        <div className="flex min-w-0 flex-row items-center gap-3">
          <Avatar
            className="h-8 w-8 shrink-0"
            alt={member.user.displayName}
            name={member.user.displayName || 'local'}
            src={member.user.avatarUrl}
          />

          <div className="flex min-w-0 flex-col">
            <div className="flex flex-row items-center gap-2">
              <span className="truncate font-medium">
                {member.user.displayName}
              </span>
              {isSelf && (
                <Badge className="pointer-events-none h-5 shrink-0 border-transparent bg-primary/10 px-1.5 font-bold text-primary text-xs">
                  You
                </Badge>
              )}
            </div>
            <span className="truncate text-muted-foreground text-sm">
              {member.user.email}
            </span>
          </div>
        </div>

        <div className="flex shrink-0 flex-row items-center gap-4 sm:gap-6">
          <RoleBadge role={member.role} />

          <div className="flex flex-row items-center gap-1">
            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex',
                    !canUpdateRole && 'cursor-not-allowed',
                  )}
                >
                  <Button
                    variant="subtle"
                    aria-label="Update role"
                    disabled={!canUpdateRole}
                    onClick={() => {
                      form.reset({
                        email: member.user.email,
                        role: member.role,
                      });
                      setUpdateMemberRoleDialogOpen(true);
                    }}
                  >
                    <UserCog />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{updateRoleTooltip}</TooltipContent>
            </Tooltip>

            <Tooltip>
              <TooltipTrigger asChild>
                <span
                  className={cn(
                    'inline-flex',
                    !canManage && 'cursor-not-allowed',
                  )}
                >
                  <Button
                    variant="subtle"
                    aria-label="Remove from organization"
                    className="hover:text-destructive dark:hover:text-destructive"
                    disabled={!canManage}
                    onClick={() => setConfirmRemoveMemberDialogOpen(true)}
                  >
                    <Trash2 />
                  </Button>
                </span>
              </TooltipTrigger>
              <TooltipContent>{removeMemberTooltip}</TooltipContent>
            </Tooltip>
          </div>
        </div>
      </div>

      <AlertDialog
        open={confirmRemoveMemberDialogOpen}
        onOpenChange={setConfirmRemoveMemberDialogOpen}
      >
        <AlertDialogContent className="p-12 text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-xl">
              Remove member?
            </AlertDialogTitle>
            <AlertDialogDescription>
              This will remove{' '}
              <strong className="font-semibold text-foreground">
                {member.user.displayName}
              </strong>{' '}
              ({member.user.email}) from{' '}
              <strong className="font-semibold text-foreground">
                {orgName}
              </strong>
              . They&apos;ll lose access to every project in it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="mt-8">
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMemberFromOrg}
              variant="destructive"
            >
              Remove member
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog
        open={updateMemberRoleDialogOpen}
        onOpenChange={(value) => {
          form.reset();
          setUpdateMemberRoleDialogOpen(value);
        }}
      >
        <DialogContent className="p-12 text-foreground sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)}>
              <DialogHeader className="mb-4">
                <DialogTitle className="text-xl leading-7 tracking-normal">
                  Update member role
                </DialogTitle>
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
              <DialogFooter className="mt-8">
                <Button
                  variant="outline"
                  type="button"
                  onClick={handleDismissDialog}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={form.watch('role') === member.role}
                >
                  Update
                </Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </>
  );
}
