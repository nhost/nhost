import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
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
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { cn } from '@/lib/utils';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useBillingTransferAppMutation } from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogDescription } from '@radix-ui/react-dialog';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const transferProjectFormSchema = z.object({
  organization: z.string(),
});

export default function TransferProject() {
  const { orgs } = useOrgs();
  const { org: currentOrg } = useCurrentOrg();
  const { push } = useRouter();
  const { maintenanceActive } = useUI();
  const [open, setOpen] = useState(false);
  const { project } = useProject();
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

  return (
    <>
      <SettingsContainer
        title="Transfer Project"
        description="Move the current project to a different organization."
        submitButtonText="Transfer"
        slotProps={{
          submitButton: {
            type: 'button',
            color: 'primary',
            variant: 'contained',
            disabled: maintenanceActive,
            onClick: () => setOpen(true),
          },
        }}
      />

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="text-foreground sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>
              Move the current project to a different organization.
            </DialogTitle>
            <DialogDescription />
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
                              org.plan.isFree || org.id === currentOrg.id
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
                  onClick={() => setOpen(false)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={form.formState.isSubmitting}>
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
    </>
  );
}
