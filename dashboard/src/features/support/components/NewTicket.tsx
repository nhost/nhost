import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/router';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import {
  MultiSelect,
  MultiSelectContent,
  MultiSelectGroup,
  MultiSelectItem,
  MultiSelectTrigger,
  MultiSelectValue,
} from '@/components/ui/v3/multi-select';
import { SelectItem } from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import DraftAttachments from '@/features/support/components/DraftAttachments';
import {
  SupportBreadcrumb,
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
  const availableOrganizations = organizations.data?.organizations;
  const organizationLocked =
    draft.hasFiles || draft.busy || form.formState.isSubmitting;
  useEffect(() => {
    if (availableOrganizations?.length !== 1 || organizationLocked) {
      return;
    }
    const singleOrganization = availableOrganizations[0];
    if (form.getValues('organizationID') !== singleOrganization.id) {
      form.setValue('organizationID', singleOrganization.id, {
        shouldValidate: true,
      });
      form.setValue('projectID', 'none');
    }
  }, [availableOrganizations, organizationLocked, form]);
  const selectedOrganization = organizations.data?.organizations.find(
    (organization) => organization.id === organizationID,
  );
  useEffect(() => {
    if (!selectedOrganization || form.formState.isSubmitting) {
      return;
    }
    const projects = selectedOrganization.apps;
    if (projects.length === 1) {
      form.setValue('projectID', projects[0].id, { shouldValidate: true });
    } else if (
      !projects.some((project) => project.id === form.getValues('projectID'))
    ) {
      form.setValue('projectID', 'none');
    }
  }, [selectedOrganization, form, form.formState.isSubmitting]);
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
        <SupportBreadcrumb currentPage="New ticket" />
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
      <div className="space-y-6 p-5 sm:p-8">
        <SupportBreadcrumb currentPage="New ticket" />
        <Spinner wrapperClassName="py-16">Loading your organizations…</Spinner>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-5 sm:p-8">
      <SupportBreadcrumb currentPage="New ticket" />
      <header>
        <h1 className="font-semibold text-2xl">New ticket</h1>
      </header>
      {organizations.data?.organizations.length === 0 ? (
        <SupportError message="You need to belong to an organization before creating a support ticket." />
      ) : (
        <FormProvider {...form}>
          <Form
            className="space-y-6"
            onDragOverCapture={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
              }
            }}
            onDropCapture={(event) => {
              if (event.dataTransfer.types.includes('Files')) {
                event.preventDefault();
              }
            }}
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
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormSelect
                control={form.control}
                name="organizationID"
                label="Organization"
                placeholder="Select an organization"
                disabled={
                  organizationLocked || availableOrganizations?.length === 1
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
                disabled={
                  !selectedOrganization ||
                  selectedOrganization.apps.length === 1
                }
              >
                <SelectItem value="none">No project</SelectItem>
                {selectedOrganization?.apps.map((project) => (
                  <SelectItem key={project.id} value={project.id}>
                    {project.name}
                  </SelectItem>
                ))}
              </FormSelect>
              <FormSelect
                control={form.control}
                name="severity"
                label="Severity"
                disabled={!selectedOrganization || form.formState.isSubmitting}
                helperText={
                  selectedOrganization && allowedSeverities.length === 0
                    ? 'Not available on this plan'
                    : undefined
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
                    <FormLabel>Services</FormLabel>
                    <MultiSelect
                      values={field.value}
                      onValuesChange={field.onChange}
                    >
                      <FormControl>
                        <MultiSelectTrigger
                          className="w-full"
                          onBlur={field.onBlur}
                        >
                          <MultiSelectValue placeholder="Select services" />
                        </MultiSelectTrigger>
                      </FormControl>
                      <MultiSelectContent>
                        <MultiSelectGroup>
                          {SERVICES.map((service) => (
                            <MultiSelectItem key={service} value={service}>
                              {supportLabel(service)}
                            </MultiSelectItem>
                          ))}
                        </MultiSelectGroup>
                      </MultiSelectContent>
                    </MultiSelect>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormInput
              control={form.control}
              name="title"
              label="Title"
              placeholder="Short summary"
            />
            <SupportMarkdownEditor
              control={form.control}
              name="description"
              label="Description"
              placeholder="What happened, and how can we reproduce it?"
              disabled={form.formState.isSubmitting}
              filesDisabled={
                !selectedOrganization ||
                draft.busy ||
                draft.query.isError ||
                !!draft.query.data?.ticketID ||
                draft.submissionUncertain
              }
              attachmentScope={
                draft.identity ? { draftId: draft.identity.id } : undefined
              }
              onFilesDrop={(files, onUploaded) => {
                return execPromiseWithErrorToast(
                  () =>
                    draft.action.mutateAsync({
                      type: 'upload',
                      files,
                      onUploaded,
                    }),
                  {
                    loadingMessage: 'Uploading draft attachments…',
                    successMessage: 'Files uploaded',
                    errorMessage: 'Unable to upload draft attachments.',
                  },
                );
              }}
              attachments={(_insert, uploadFiles) => (
                <DraftAttachments
                  draft={draft}
                  disabled={
                    form.formState.isSubmitting || !selectedOrganization
                  }
                  onFiles={uploadFiles}
                  organizationSelected={!!selectedOrganization}
                />
              )}
            />
            {draft.blocked && !draft.busy && !draft.query.isError && (
              <p className="text-muted-foreground text-sm">
                Upload or remove unfinished attachments before creating the
                ticket.
              </p>
            )}
            <div className="flex flex-wrap items-center justify-between gap-4">
              <p className="text-muted-foreground text-xs">
                Visible to everyone in your organization. Don't share passwords
                or keys.
              </p>
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
