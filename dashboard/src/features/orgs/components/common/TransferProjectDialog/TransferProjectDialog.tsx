import { Badge } from '@/components/ui/v3/badge';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';

import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useOrgs, type Org } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { cn } from '@/lib/utils';
import {
  Organization_Members_Role_Enum,
  useBillingTransferAppMutation,
} from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { useUserId } from '@nhost/nextjs';
import { useRouter } from 'next/router';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

interface TransferProjectDialogProps {
  open: boolean;
  setOpen: (value: boolean) => void;
}

const transferProjectFormSchema = z.object({
  organization: z.string(),
});

export default function TransferProjectDialog({
  open,
  setOpen,
}: TransferProjectDialogProps) {
  const { push } = useRouter();
  const currentUserId = useUserId();
  const { project } = useProject();
  const { orgs, currentOrg } = useOrgs();
  const [transferProject] = useBillingTransferAppMutation();

  const form = useForm<z.infer<typeof transferProjectFormSchema>>({
    resolver: zodResolver(transferProjectFormSchema),
    defaultValues: {
      organization: '',
    },
  });

  const onSubmit = async (
    values: z.infer<typeof transferProjectFormSchema>,
  ) => {
    const { organization } = values;

    await execPromiseWithErrorToast(
      async () => {
        await transferProject({
          variables: {
            appID: project?.id,
            organizationID: organization,
          },
        });

        const targetOrg = orgs.find((o) => o.id === organization);
        await push(`/orgs/${targetOrg.slug}/projects`);
      },
      {
        loadingMessage: 'Transferring project...',
        successMessage: 'Project transferred successfully!',
        errorMessage: 'Error transferring project. Please try again.',
      },
    );
  };

  const isUserAdminOfOrg = (org: Org, userId: string) =>
    org.members.some(
      (member) =>
        member.role === Organization_Members_Role_Enum.Admin &&
        member.user.id === userId,
    );

  return (
    <Dialog
      open={open}
      onOpenChange={(value) => {
        form.reset();
        setOpen(value);
      }}
    >
      <DialogContent className="z-[9999] text-foreground sm:max-w-xl">
        <DialogHeader className="flex gap-2">
          <DialogTitle>
            Move the current project to a different organization.
          </DialogTitle>
          <DialogDescription>
            To transfer a project between organizations, you must be an{' '}
            <span className="font-bold">ADMIN</span> in both.
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="organization"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Organization</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    defaultValue={field.value}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Organization" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {orgs.map((org) => (
                        <SelectItem
                          key={org.id}
                          value={org.id}
                          disabled={
                            org.plan.isFree || // disable the personal org
                            org.id === currentOrg.id || // disable the current org as it can't be a destination org
                            !isUserAdminOfOrg(org, currentUserId) // disable orgs that the current user is not admin of
                          }
                        >
                          {org.name}
                          <Badge
                            variant={org.plan.isFree ? 'outline' : 'default'}
                            className={cn(
                              org.plan.isFree ? 'bg-muted' : '',
                              'hover:none ml-2 h-5 px-[6px] text-[10px]',
                            )}
                          >
                            {org.plan.name}
                          </Badge>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex justify-end space-x-2">
              <Button
                variant="secondary"
                type="button"
                disabled={form.formState.isSubmitting}
                onClick={() => {
                  form.reset();
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                {form.formState.isSubmitting ? (
                  <ActivityIndicator />
                ) : (
                  'Transfer'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
