import { zodResolver } from '@hookform/resolvers/zod';
import { Plus, Send } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
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
import { RouteTabLink, RouteTabs } from '@/components/ui/v3/route-tabs';
import { RoleSelector } from '@/features/orgs/components/members/components/RoleSelector';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  Organization_Members_Role_Enum,
  useGetOrganizationInvitesQuery,
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

export default function MembersHeader() {
  const { org } = useCurrentOrg();
  const isFree = org?.plan?.isFree;
  const members = org?.members ?? [];
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);

  const {
    data: { organizationMemberInvites: invites = [] } = {},
    refetch: refetchInvites,
  } = useGetOrganizationInvitesQuery({
    variables: { organizationId: org?.id },
    skip: !org || isFree,
  });

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
        refetchInvites();
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

  const membersHref = `/orgs/${org?.slug}/members`;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex w-full flex-row items-center justify-between gap-2">
        <div className="flex flex-col gap-1">
          <h1 className="font-semibold text-3xl">Members</h1>
          <p className="text-muted-foreground text-sm">
            People in {org?.name} can manage all projects within the
            organization.
          </p>
        </div>

        {!isFree && (
          <Dialog
            open={inviteDialogOpen}
            onOpenChange={(value) => {
              form.reset();
              setInviteDialogOpen(value);
            }}
          >
            <DialogTrigger asChild>
              <Button className="shrink-0 gap-2">
                <Plus />
                Add member
              </Button>
            </DialogTrigger>
            <DialogContent
              aria-describedby={undefined}
              className="p-12 text-foreground sm:max-w-xl"
            >
              <Form {...form}>
                <form onSubmit={form.handleSubmit(onSubmit)}>
                  <DialogHeader className="mb-4">
                    <DialogTitle className="text-foreground text-xl leading-7 tracking-normal">
                      Add a member
                    </DialogTitle>
                  </DialogHeader>

                  <div className="mb-12 flex flex-col gap-4">
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
                      variant="outline"
                      type="button"
                      onClick={handleDismissDialog}
                    >
                      Cancel
                    </Button>
                    <Button type="submit" className="gap-2">
                      <Send />
                      Send
                    </Button>
                  </DialogFooter>
                </form>
              </Form>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <RouteTabs aria-label="Members section navigation">
        <RouteTabLink href={membersHref} exact>
          Members {members.length > 0 && `(${members.length})`}
        </RouteTabLink>
        {!isFree && (
          <RouteTabLink href={`${membersHref}/invites`}>
            Pending invites {invites.length > 0 && `(${invites.length})`}
          </RouteTabLink>
        )}
      </RouteTabs>
    </div>
  );
}
