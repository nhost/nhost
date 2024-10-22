import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
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

import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Badge } from '@/components/ui/v3/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { cn } from '@/lib/utils';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
import { useBillingMigrateProjectToOrganizationMutation } from '@/utils/__generated__/graphql';
import { zodResolver } from '@hookform/resolvers/zod';
import { DialogDescription } from '@radix-ui/react-dialog';
import { CornerRightUp } from 'lucide-react';
import { useRouter } from 'next/router';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';

const migrateFormSchema = z.object({
  organization: z.string(),
});

export default function MigrateProjectToOrg() {
  const { push } = useRouter();
  const { orgs } = useOrgs();
  const [open, setOpen] = useState(false);
  const { currentProject } = useCurrentWorkspaceAndProject();
  const [migrateProjectToOrg] =
    useBillingMigrateProjectToOrganizationMutation();

  const form = useForm<z.infer<typeof migrateFormSchema>>({
    resolver: zodResolver(migrateFormSchema),
    defaultValues: {
      organization: '',
    },
  });

  const onSubmit = async (values: z.infer<typeof migrateFormSchema>) => {
    const { organization } = values;

    await execPromiseWithErrorToast(
      async () => {
        await migrateProjectToOrg({
          variables: {
            appID: currentProject?.id,
            organizationID: organization,
          },
        });

        const targetOrg = orgs.find((o) => o.id === organization);
        await push(`/orgs/${targetOrg.slug}/projects`);
      },
      {
        loadingMessage: 'Migrating project',
        successMessage: 'Success',
        errorMessage: 'An error occurred while migrating project!',
      },
    );
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          className="flex items-center gap-2 text-base h-9 text-primary hover:text-primary"
        >
          Migrate
          <CornerRightUp className="w-5 h-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="text-foreground sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Migrate project to an Organization</DialogTitle>
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
                          disabled={org.plan.isFree}
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
                  'Migrate'
                )}
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
