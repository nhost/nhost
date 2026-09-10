import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
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
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { RoleSelector } from '@/features/orgs/components/members/components/RoleSelector';
import execPromiseWithErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/execPromiseWithErrorToast';
import {
  Organization_Members_Role_Enum,
  useInsertOrganizationMemberInviteMutation,
} from '@/generated/graphql';
import { analytics } from '@/lib/segment';
import {
  errorMessageIncludes,
  getViolatedConstraint,
} from '@/utils/databaseErrors';
import { discordAnnounce } from '@/utils/discordAnnounce';

const sendInviteFormSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Organization_Members_Role_Enum),
});

export interface AddMemberDialogProps {
  onInviteSent?: () => void;
}

export default function AddMemberDialog({
  onInviteSent,
}: AddMemberDialogProps) {
  const { org } = useCurrentOrg();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const [inviteUser] = useInsertOrganizationMemberInviteMutation();

  const form = useForm<z.infer<typeof sendInviteFormSchema>>({
    resolver: zodResolver(sendInviteFormSchema),
    defaultValues: {
      email: '',
      role: Organization_Members_Role_Enum.User,
    },
  });

  const onSubmit = async (values: z.infer<typeof sendInviteFormSchema>) => {
    const { id: organizationID } = org;
    const { email, role } = values;

    await execPromiseWithErrorToast(
      async () => {
        await inviteUser({
          variables: {
            organizationMemberInvite: {
              organizationID,
              email,
              role,
            },
          },
        });

        analytics.track('Organization Invite Sent', {
          organizationId: org?.id,
          organizationName: org?.name,
          organizationSlug: org?.slug,
          organizationPlan: org?.plan?.name,
          organizationPlanId: org?.plan?.id,
          inviteeEmail: email,
          inviteeRole: role,
        });

        setInviteDialogOpen(false);
        form.reset();
        onInviteSent?.();
      },
      {
        loadingMessage: 'Sending invite...',
        successMessage: `Invite to join Organization ${org?.name} sent to ${email}.`,
        errorMessage: (error) => {
          if (
            getViolatedConstraint(error) ===
            'organization_member_invites_organization_id_email_key'
          ) {
            return `${email} has already been invited to this organization.`;
          }

          if (
            errorMessageIncludes(error, 'already a member of the organization')
          ) {
            return `${email} is already a member of this organization.`;
          }

          return 'An error occurred while sending the invite. Please try again.';
        },
        onError: async (error) => {
          await discordAnnounce(
            `Error trying to invite to ${email} to Organization ${org?.name} ${error.message}`,
          );
        },
      },
    );
  };

  const handleDismissDialog = () => {
    setInviteDialogOpen(false);
    form.reset();
  };

  return (
    <Dialog
      open={inviteDialogOpen}
      onOpenChange={(value) => {
        form.reset();
        setInviteDialogOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <div className="flex h-fit flex-row items-center justify-center space-x-2">
            <Plus className="h-5 w-5" strokeWidth={2} />
            <span>Add member</span>
          </div>
        </Button>
      </DialogTrigger>
      <DialogContent className="text-foreground p-12 sm:max-w-xl">
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <DialogHeader className="mb-4">
              <DialogTitle className="text-foreground">
                Add a member
              </DialogTitle>
              <DialogDescription>
                Send invite over email (e.g. name@mycompany.com)
              </DialogDescription>
            </DialogHeader>

            <div className="mb-8 flex flex-col gap-4">
              <FormField
                control={form.control}
                name="email"
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
              <Button type="submit">
                <div className="flex h-fit flex-row items-center justify-center space-x-2">
                  <Send className="h-4 w-4" strokeWidth={2} />
                  <span>Send</span>
                </div>
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
