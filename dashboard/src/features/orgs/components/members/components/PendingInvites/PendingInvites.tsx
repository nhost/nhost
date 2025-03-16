import { useUI } from '@/components/common/UIProvider';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Alert } from '@/components/ui/v2/Alert';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { OrgInvite } from '@/features/orgs/components/members/components/OrgInvite';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import execPromiseWithErrorToast from '@/features/orgs/utils/execPromiseWithErrorToast/execPromiseWithErrorToast';
import {
  Organization_Members_Role_Enum,
  useGetOrganizationInvitesQuery,
  useInsertOrganizationMemberInviteMutation,
} from '@/utils/__generated__/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { zodResolver } from '@hookform/resolvers/zod';
import { Inbox, TriangleAlert } from 'lucide-react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const sendInviteFormSchema = z.object({
  email: z.string().email(),
  role: z.nativeEnum(Organization_Members_Role_Enum),
});

export default function PendingInvites() {
  const { maintenanceActive } = useUI();
  const { org } = useCurrentOrg();
  const isAdmin = useIsOrgAdmin();
  const [inviteDialogOpen, setInviteDialogOpen] = useState(false);
  const [orgInviteError, setOrgInviteError] = useState(null);

  const {
    data: { organizationMemberInvites = [] } = {},
    loading,
    error: getInvitesError,
    refetch: refetchInvites,
  } = useGetOrganizationInvitesQuery({
    variables: { organizationId: org?.id },
    skip: !org,
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

        setInviteDialogOpen(false);
        setOrgInviteError(null);
        form.reset();
        refetchInvites();
      },
      {
        loadingMessage: 'Sending invite...',
        successMessage: `Invite to join Organization ${org?.name} sent to ${email}.`,
        errorMessage: null,
        onError: async (error) => {
          await discordAnnounce(
            `Error trying to invite to ${email} to Organization ${org?.name} ${error.message}`,
          );

          if (
            error.message ===
            'Foreign key violation. insert or update on table "organization_member_invites" violates foreign key constraint "organization_member_invites_email_fkey"'
          ) {
            setOrgInviteError(
              'You can only invite users that are already registered at Nhost. Ask the person to register an account, then invite them again.',
            );
          }
        },
      },
    );
  };

  const handleDismissDialog = () => {
    setInviteDialogOpen(false);
    setOrgInviteError(null);
    form.reset();
  };

  if (getInvitesError) {
    throw getInvitesError;
  }

  return (
    <div className="flex w-full flex-col rounded-md border bg-background">
      <div className="flex w-full flex-row items-center justify-between border-b p-4">
        <h4 className="font-medium">
          Pending Invites{' '}
          {organizationMemberInvites.length > 0 &&
            `(${organizationMemberInvites.length})`}
        </h4>
        <Dialog
          open={inviteDialogOpen}
          onOpenChange={(value) => {
            form.reset();
            setOrgInviteError(null);
            setInviteDialogOpen(value);
          }}
        >
          <DialogTrigger asChild>
            <Button disabled={maintenanceActive}>Add member</Button>
          </DialogTrigger>
          <DialogContent className="text-foreground sm:max-w-xl">
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

                {orgInviteError && (
                  <Alert severity="error" className="mb-4">
                    <div className="flex flex-row items-center gap-2">
                      <TriangleAlert className="h-4 w-4" strokeWidth={3} />
                      <span className="font-bold">Warning</span>
                    </div>
                    <p className="text-left">
                      An account with email {form.getValues().email} needs to
                      exist already.
                    </p>
                  </Alert>
                )}

                <div className="mb-4 flex flex-col gap-4">
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
                  <Button type="submit">Send</Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Todo add an empty state here */}
      <div className="flex w-full flex-col items-center gap-4 p-4">
        {loading && (
          <ActivityIndicator
            delay={1000}
            label="Loading pending invites..."
            className="justify-center text-sm"
          />
        )}

        {!loading &&
          organizationMemberInvites.map((invite) => (
            <OrgInvite key={invite.id} invite={invite} isAdmin={isAdmin} />
          ))}

        {!loading && organizationMemberInvites.length === 0 && (
          <div className="flex w-full flex-col items-center justify-center text-muted-foreground">
            <Inbox />
            <p className="text-sm">No pending invites</p>
          </div>
        )}
      </div>
    </div>
  );
}
