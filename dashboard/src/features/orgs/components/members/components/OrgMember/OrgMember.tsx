import { Avatar } from '@/components/ui/v2/Avatar';
import { Badge } from '@/components/ui/v3/badge';
import { Button, buttonVariants } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

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

import { useUI } from '@/components/common/UIProvider';
import { Input } from '@/components/ui/v3/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import {
  Organization_Members_Role_Enum,
  useDeleteOrganizationMemberMutation,
  useUpdateOrganizationMemberMutation,
  type GetOrganizationQuery,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUserData } from '@nhost/nextjs';
import { Ellipsis } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

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
  const { maintenanceActive } = useUI();
  const { id } = useUserData();
  const { push } = useRouter();
  const { refetch: refetchOrgs } = useOrgs();
  const { org: { plan: { isFree } = {} } = {}, refetch: refetchCurrentOrg } =
    useCurrentOrg();
  const [dropDownOpen, setDropDownOpen] = useState(false);
  const [confirmRemoveMemberDialogOpen, setConfirmRemoveMemberDialogOpen] =
    useState(false);
  const [updateMemberRoleDialogOpen, setUpdateMemberRoleDialogOpen] =
    useState(false);

  const isSelf = id === member.user.id;

  const [deleteMember] = useDeleteOrganizationMemberMutation({
    variables: {
      memberId: member.id,
    },
  });

  const handleRemoveMemberFromOrg = async () => {
    await execPromiseWithErrorToast(
      async () => {
        const isRemovingSelf = id === member.user.id;
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
        errorMessage: `Failed to remove member! Please try again`,
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
        errorMessage: `An error occured while updating the member role! Please try again.`,
      },
    );
  };

  const handleDismissDialog = () => {
    form.reset();
    setUpdateMemberRoleDialogOpen(false);
  };

  return (
    <>
      <div className="flex w-full flex-row place-content-between">
        <div className="flex flex-row items-center">
          <Avatar
            className="rounded-full"
            alt={member.user.displayName}
            src={member.user.avatarUrl}
          >
            {member.user.displayName || 'local'}
          </Avatar>

          <div className="ml-3 flex flex-col">
            <div className="flex flex-row items-center gap-2">
              <span className="font-medium">{member.user.displayName}</span>
              {isSelf && (
                <Badge className="pointer-events-none h-5 bg-blue-100 px-[6px] text-[10px] font-bold text-primary-main dark:bg-primary">
                  Me
                </Badge>
              )}
            </div>
            <span className="text-sm text-muted-foreground">
              {member.user.email}
            </span>
          </div>
        </div>

        <div className="flex flex-row items-center gap-4">
          <span className="font-medium">{member.role}</span>

          <DropdownMenu open={dropDownOpen} onOpenChange={setDropDownOpen}>
            <DropdownMenuTrigger
              disabled={
                (!isAdmin && id !== member.user.id) ||
                isFree ||
                maintenanceActive
              }
              asChild
              className="h-fit"
            >
              <Button variant="ghost" className="h-8 p-2">
                <Ellipsis />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent side="bottom" align="end" sideOffset={-5}>
              <DropdownMenuItem
                disabled={!isAdmin}
                onSelect={() => {
                  setDropDownOpen(false);
                  setUpdateMemberRoleDialogOpen(true);
                }}
              >
                Update role
              </DropdownMenuItem>
              <DropdownMenuItem
                onSelect={() => {
                  setDropDownOpen(false);
                  setConfirmRemoveMemberDialogOpen(true);
                }}
              >
                Remove from organization
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      <AlertDialog
        open={confirmRemoveMemberDialogOpen}
        onOpenChange={setConfirmRemoveMemberDialogOpen}
      >
        <AlertDialogContent className="text-foreground">
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action will remove the member from organization.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleRemoveMemberFromOrg}
              className={buttonVariants({ variant: 'destructive' })}
            >
              Continue
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
        <DialogContent className="text-foreground sm:max-w-xl">
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onUpdateSubmit)}>
              <DialogHeader className="mb-4">
                <DialogTitle>Update member role</DialogTitle>
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
                            <SelectValue placeholder="email" />
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
