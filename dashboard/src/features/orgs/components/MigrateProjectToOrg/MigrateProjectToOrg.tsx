import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/v3/dialog';
import CreateOrgDialog from '@/features/orgs/components/CreateOrgFormDialog/CreateOrgFormDialog';

import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';

import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
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
import { useBillingMigrateProjectToOrganizationMutation } from '@/utils/__generated__/graphql';
import { execPromiseWithErrorToast } from '@/utils/execPromiseWithErrorToast';
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

  const noValidOrg = orgs.every((o) => o.plan.isFree);

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
    <Dialog
      open={open}
      onOpenChange={(value) => {
        form.reset();
        setOpen(value);
      }}
    >
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2 py-1 text-base">
          Migrate to an Organization
          <CornerRightUp className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="text-foreground sm:max-w-xl">
        <DialogHeader className="gap-2">
          <DialogTitle>Migrate project to an Organization</DialogTitle>
          <DialogDescription className="flex flex-col gap-2 text-sm text-muted-foreground">
            <span className="mt-4 font-medium">
              Please read the following information before migrating:
            </span>
            <ul className="list-disc space-y-2 pl-4">
              <li>
                A project can only be migrated to an organization in the same or
                higher plan as the project you are migrating.
              </li>
              <li className="mt-4">
                Any remaining usage credits in your current workspace will be
                transferred and credited to the target organization.
              </li>
              <li className="mt-4">
                While there is no downtime for stateless services, Postgres
                requires a restart so plan for 1-2 minutes of downtime.
              </li>
            </ul>
            <div className="mt-4 flex items-center justify-start gap-1">
              <span>For more information read the</span>
              <Link
                href="https://nhost.io/blog/organization-billing"
                target="_blank"
                rel="noopener noreferrer"
                underline="hover"
                className="font-medium"
              >
                announcement
                <ArrowSquareOutIcon className="mb-1 ml-1 h-4 w-4" />
              </Link>
            </div>
          </DialogDescription>
        </DialogHeader>
        {noValidOrg && (
          <>
            <span className="text-sm">
              We couldn&apos;t find a {currentProject.legacyPlan.name}{' '}
              organization, please create one first.
            </span>
            <CreateOrgDialog />
          </>
        )}
        {!noValidOrg && (
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
                    'Migrate'
                  )}
                </Button>
              </div>
            </form>
          </Form>
        )}
      </DialogContent>
    </Dialog>
  );
}
