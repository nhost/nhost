import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { FormTextarea } from '@/components/form/FormTextarea';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { FormField, FormItem, FormMessage } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  SupportBackLink,
  SupportError,
} from '@/features/support/components/SupportArea';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  SERVICES,
  SEVERITIES,
  supportLabel,
  type TicketFormValues,
  ticketFormSchema,
} from '@/features/support/utils/tickets';
import {
  DashboardCreateSupportTicketDocument,
  type DashboardCreateSupportTicketMutation,
  DashboardSupportOrganizationsDocument,
  type DashboardSupportOrganizationsQuery,
  SupportSeverities_Enum,
} from '@/generated/graphql';

export default function NewTicket() {
  const router = useRouter();
  const client = useQueryClient();
  const { user, request } = useSupportSession();
  const form = useForm<TicketFormValues>({
    resolver: zodResolver(ticketFormSchema),
    defaultValues: {
      organizationID: '',
      projectID: 'none',
      title: '',
      description: '',
      severity: SupportSeverities_Enum.Normal,
      services: [],
    },
  });
  const organizationID = form.watch('organizationID');
  const organizations = useQuery({
    queryKey: ['support', user?.id, 'user', 'organizations'],
    queryFn: ({ signal }) =>
      request<DashboardSupportOrganizationsQuery>(
        DashboardSupportOrganizationsDocument,
        { userId: user?.id },
        signal,
        'user',
      ),
    enabled: !!user,
    cacheTime: 0,
    retry: false,
  });
  const selectedOrganization = organizations.data?.organizations.find(
    (organization) => organization.id === organizationID,
  );
  const create = useMutation({
    mutationFn: async (values: TicketFormValues) => {
      const organization = organizations.data?.organizations.find(
        (candidate) => candidate.id === values.organizationID,
      );
      if (
        !organization ||
        (values.projectID !== 'none' &&
          !organization.apps.some((project) => project.id === values.projectID))
      ) {
        throw new Error('Select an organization and one of its projects.');
      }
      const result = await request<DashboardCreateSupportTicketMutation>(
        DashboardCreateSupportTicketDocument,
        {
          input: {
            ...values,
            projectID: values.projectID === 'none' ? null : values.projectID,
          },
        },
        undefined,
        'user',
      );
      if (!result.insertSupportTicket) {
        throw new Error('The ticket was not created. Please try again.');
      }
      return result.insertSupportTicket.id as string;
    },
    onSuccess: async (id) => {
      await client.invalidateQueries({ queryKey: ['support', user?.id] });
      await router.push(`/support/tickets/${id}`);
    },
  });

  if (organizations.isError) {
    return (
      <div className="space-y-6 p-8">
        <SupportBackLink />
        <SupportError
          message="Unable to load your organizations. Please try again."
          retry={() => {
            void organizations.refetch();
          }}
        />
      </div>
    );
  }
  if (organizations.isLoading) {
    return (
      <Spinner wrapperClassName="py-16">Loading your organizations…</Spinner>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 p-5 sm:p-8">
      <SupportBackLink />
      <header>
        <h1 className="font-semibold text-2xl">Create a support ticket</h1>
        <p className="mt-2 text-muted-foreground text-sm">
          Tell us what happened. Everyone in your organization can follow this
          conversation.
        </p>
      </header>
      {organizations.data?.organizations.length === 0 ? (
        <SupportError message="You need to belong to an organization before creating a support ticket." />
      ) : (
        <FormProvider {...form}>
          <Form
            className="space-y-6 rounded-lg border p-5 sm:p-8"
            onSubmit={async (values: TicketFormValues) => {
              await execPromiseWithErrorToast(
                () => create.mutateAsync(values),
                {
                  loadingMessage: 'Creating ticket…',
                  successMessage: 'Ticket created',
                  errorMessage:
                    'Unable to create your ticket. Please try again.',
                },
              );
            }}
          >
            <div className="grid gap-5 sm:grid-cols-2">
              <FormSelect
                control={form.control}
                name="organizationID"
                label="Organization"
                placeholder="Select an organization"
                onChange={() => form.setValue('projectID', 'none')}
              >
                {organizations.data?.organizations.map((organization) => (
                  <SelectItem key={organization.id} value={organization.id}>
                    {organization.name}
                  </SelectItem>
                ))}
              </FormSelect>
              <FormSelect
                control={form.control}
                name="projectID"
                label="Project"
                disabled={!selectedOrganization}
              >
                <SelectItem value="none">
                  Organization-wide / No project
                </SelectItem>
                {selectedOrganization?.apps.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </FormSelect>
            </div>
            <FormSelect control={form.control} name="severity" label="Severity">
              {SEVERITIES.map((severity) => (
                <SelectItem key={severity} value={severity}>
                  {supportLabel(severity)}
                </SelectItem>
              ))}
            </FormSelect>
            <FormField
              control={form.control}
              name="services"
              render={({ field }) => (
                <FormItem>
                  <fieldset>
                    <legend className="mb-3 font-medium text-sm">
                      Affected services
                    </legend>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                      {SERVICES.map((service) => (
                        <label
                          key={service}
                          htmlFor={`support-service-${service}`}
                          className="flex items-center gap-2 text-sm"
                        >
                          <Checkbox
                            id={`support-service-${service}`}
                            checked={field.value.includes(service)}
                            onCheckedChange={(checked) =>
                              field.onChange(
                                checked === true
                                  ? [...field.value, service]
                                  : field.value.filter(
                                      (value) => value !== service,
                                    ),
                              )
                            }
                          />
                          {supportLabel(service)}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormInput
              control={form.control}
              name="title"
              label="Title"
              placeholder="A short summary of the issue"
            />
            <FormTextarea
              control={form.control}
              name="description"
              label="Description"
              placeholder="What did you expect, what happened, and how can we reproduce it?"
              className="min-h-48"
            />
            <p className="text-muted-foreground text-xs">
              Do not include passwords, access tokens, or other secrets. Replies
              appear here in the dashboard; email notifications are not enabled.
            </p>
            <div className="flex justify-end">
              <ButtonWithLoading
                type="submit"
                loading={form.formState.isSubmitting}
              >
                Create ticket
              </ButtonWithLoading>
            </div>
          </Form>
        </FormProvider>
      )}
    </div>
  );
}
