import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { FormField, FormItem, FormMessage } from '@/components/ui/v3/form';
import { SelectItem } from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import DraftAttachments from '@/features/support/components/DraftAttachments';
import {
  SupportBackLink,
  SupportError,
} from '@/features/support/components/SupportArea';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import { useSupportAttachmentDraft } from '@/features/support/hooks/use-support-attachment-draft';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  getAllowedSupportSeverities,
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
  const { user } = useSupportSession();
  return <NewTicketForm key={user?.id ?? 'signed-out'} />;
}

function NewTicketForm() {
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
      severity: SupportSeverities_Enum.Low,
      services: [],
    },
  });
  const organizationID = form.watch('organizationID');
  const draft = useSupportAttachmentDraft(organizationID);
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
  const allowedSeverities = getAllowedSupportSeverities(
    selectedOrganization?.plan?.supportAllowedSeverities,
  );
  const selectedSeverity = form.watch('severity');
  useEffect(() => {
    const allowed = getAllowedSupportSeverities(
      selectedOrganization?.plan?.supportAllowedSeverities,
    );
    if (allowed[0] && !allowed.includes(form.getValues('severity'))) {
      form.setValue('severity', allowed[0], { shouldValidate: true });
    }
  }, [selectedOrganization, form]);
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
      const submission = await draft.prepareSubmission();
      if (submission.ticketID) {
        return submission.ticketID;
      }
      if (
        !getAllowedSupportSeverities(
          organization.plan?.supportAllowedSeverities,
        ).includes(values.severity)
      ) {
        throw new Error(
          'Select a severity available on this organization’s plan.',
        );
      }
      try {
        const result = await request<DashboardCreateSupportTicketMutation>(
          DashboardCreateSupportTicketDocument,
          {
            input: {
              ...values,
              projectID: values.projectID === 'none' ? null : values.projectID,
              ...(submission.draftID
                ? { attachmentDraftID: submission.draftID }
                : {}),
            },
          },
          undefined,
          'user',
        );
        if (!result.insertSupportTicket) {
          throw new Error('The ticket was not created. Please try again.');
        }
        return result.insertSupportTicket.id as string;
      } catch (error: unknown) {
        if (submission.draftID) {
          try {
            const recoveredID = await draft.recoverSubmission();
            if (recoveredID) {
              return recoveredID;
            }
          } catch (recoveryError: unknown) {
            console.error(
              'Unable to confirm draft submission',
              recoveryError instanceof Error
                ? recoveryError.message
                : 'Unknown error',
            );
            throw new Error(
              'Ticket submission could not be confirmed. Reload draft attachments and retry with this draft instead of starting a new ticket.',
            );
          }
        }
        throw error;
      }
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
                disabled={
                  draft.hasFiles || draft.busy || form.formState.isSubmitting
                }
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
            <FormSelect
              control={form.control}
              name="severity"
              label="Severity"
              disabled={!selectedOrganization || form.formState.isSubmitting}
              helperText={
                !selectedOrganization
                  ? 'Select an organization to see its allowed severities.'
                  : allowedSeverities.length === 0
                    ? 'This organization’s plan does not allow new support tickets.'
                    : 'Available severities are determined by the organization’s plan.'
              }
            >
              {SEVERITIES.map((severity) => (
                <SelectItem
                  key={severity}
                  value={severity}
                  disabled={!allowedSeverities.includes(severity)}
                >
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
            <SupportMarkdownEditor
              control={form.control}
              name="description"
              label="Description"
              placeholder="What did you expect, what happened, and how can we reproduce it?"
              disabled={form.formState.isSubmitting}
            />
            <p className="text-muted-foreground text-xs">
              Do not include passwords, access tokens, or other secrets.
            </p>
            <DraftAttachments
              draft={draft}
              disabled={form.formState.isSubmitting || !selectedOrganization}
            />
            {draft.blocked && !draft.busy && !draft.query.isError && (
              <p className="text-muted-foreground text-sm">
                Upload or remove unfinished attachments before creating the
                ticket.
              </p>
            )}
            <div className="flex justify-end">
              <ButtonWithLoading
                type="submit"
                loading={form.formState.isSubmitting}
                disabled={
                  draft.blocked || !allowedSeverities.includes(selectedSeverity)
                }
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
