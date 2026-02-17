import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { Badge } from '@/components/ui/v3/badge';
import { ButtonWithLoading as Button } from '@/components/ui/v3/button';
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
import { type Org, useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUserData } from '@/hooks/useUserData';
import { cn, isNotEmptyValue } from '@/lib/utils';
import { ApplicationStatus } from '@/types/application';
import {
  Organization_Members_Role_Enum,
  useBillingTransferAppMutation,
} from '@/utils/__generated__/graphql';

const CREATE_NEW_ORG = 'createNewOrg';

const transferProjectFormSchema = z.object({
  organization: z.string(),
});

export interface TransferProjectFormProps {
  onCreateNewOrg: () => void;
  onCancel: () => void;
  selectedOrganizationId?: string;
  onOrganizationChange(value: string): void;
}

function TransferProjectForm({
  onCreateNewOrg,
  selectedOrganizationId,
  onCancel,
  onOrganizationChange,
}: TransferProjectFormProps) {
  const { push } = useRouter();
  const { orgs, currentOrg } = useOrgs();
  const { project } = useProject();
  const user = useUserData();
  const isProjectNotPaused = project?.desiredState !== ApplicationStatus.Paused;
  const [transferProject] = useBillingTransferAppMutation();

  const form = useForm<z.infer<typeof transferProjectFormSchema>>({
    resolver: zodResolver(transferProjectFormSchema),
    defaultValues: {
      organization: '',
    },
  });

  useEffect(() => {
    if (isNotEmptyValue(selectedOrganizationId)) {
      form.setValue('organization', selectedOrganizationId, {
        shouldDirty: true,
      });
    }
  }, [selectedOrganizationId, form]);

  const isUserAdminOfOrg = (org: Org, userId?: string) =>
    org.members.some(
      (member) =>
        member.role === Organization_Members_Role_Enum.Admin &&
        member.user.id === userId,
    );

  const createNewFormSelected = form.watch('organization') === CREATE_NEW_ORG;
  const submitButtonText = createNewFormSelected ? 'Continue' : 'Transfer';

  const onSubmit = async (
    values: z.infer<typeof transferProjectFormSchema>,
  ) => {
    const { organization } = values;

    if (organization === CREATE_NEW_ORG) {
      onCreateNewOrg();
    } else {
      await execPromiseWithErrorToast(
        async () => {
          await transferProject({
            variables: {
              appID: project?.id,
              organizationID: organization,
            },
          });

          const targetOrg = orgs.find((o) => o.id === organization);
          if (targetOrg) {
            await push(`/orgs/${targetOrg.slug}/projects`);
          }
        },
        {
          loadingMessage: 'Transferring project...',
          successMessage: 'Project transferred successfully!',
          errorMessage: 'Error transferring project. Please try again.',
        },
      );
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="organization"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Organization</FormLabel>
              <Select onValueChange={onOrganizationChange} value={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue placeholder="Organization" />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  {orgs
                    .filter((org) => org.id !== currentOrg?.id)
                    .map((org) => (
                      <SelectItem
                        key={org.id}
                        value={org.id}
                        textContent={org.name}
                        disabled={
                          (org.plan.isFree && isProjectNotPaused) || // disable free orgs unless project is paused
                          !isUserAdminOfOrg(org, user?.id) // disable orgs that the current user is not admin of
                        }
                      >
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
                  <SelectItem key={CREATE_NEW_ORG} value={CREATE_NEW_ORG}>
                    <div className="flex items-center justify-center gap-2">
                      <Plus className="h-4 w-4 font-bold" strokeWidth={3} />{' '}
                      <span>New Organization</span>
                    </div>
                  </SelectItem>
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
            onClick={onCancel}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            disabled={form.formState.isSubmitting || !form.formState.isDirty}
            loading={form.formState.isSubmitting}
          >
            {submitButtonText}
          </Button>
        </div>
      </form>
    </Form>
  );
}

export default TransferProjectForm;
