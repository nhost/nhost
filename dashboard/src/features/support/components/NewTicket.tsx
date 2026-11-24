import { zodResolver } from '@hookform/resolvers/zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import { useRouter } from 'next/router';
import { useEffect, useRef, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { FormSelect } from '@/components/form/FormSelect';
import OrganizationPlanBadge from '@/components/layout/Header/OrganizationPlanBadge';
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/v3/alert-dialog';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import {
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/v3/form';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { Spinner } from '@/components/ui/v3/spinner';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { SubscriptionPlan } from '@/features/orgs/components/billing/SubscriptionPlan';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import DraftAttachments from '@/features/support/components/DraftAttachments';
import SeverityPlanHelp from '@/features/support/components/SeverityPlanHelp';
import {
  SupportBreadcrumb,
  SupportError,
} from '@/features/support/components/SupportArea';
import SupportMarkdownEditor from '@/features/support/components/SupportMarkdownEditor';
import { useSupportAttachmentDraft } from '@/features/support/hooks/use-support-attachment-draft';
import { useSupportSession } from '@/features/support/hooks/use-support-session';
import {
  attachmentValidationError,
  SUPPORT_ATTACHMENT_TOKEN_PATTERN,
  supportAttachmentId,
} from '@/features/support/utils/attachments';
import { SERVICE_ICONS } from '@/features/support/utils/service-icons';
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
import { cn } from '@/lib/utils';

const severityHints = {
  low: 'Question or minor issue',
  normal: 'Something works, but not well',
  high: 'A feature is broken',
  urgent: 'Production is down',
};

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
  const [upgradeOrgSlug, setUpgradeOrgSlug] = useState<string>();
  const organizationTrigger = useRef<HTMLButtonElement>(null);
  const [pendingOrganization, setPendingOrganization] = useState<string>();
  const [changingOrganization, setChangingOrganization] = useState(false);
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
    draft.busy || changingOrganization || form.formState.isSubmitting;
  useEffect(() => {
    if (
      availableOrganizations?.length !== 1 ||
      organizationLocked ||
      draft.hasFiles ||
      pendingOrganization
    ) {
      return;
    }
    const singleOrganization = availableOrganizations[0];
    if (form.getValues('organizationID') !== singleOrganization.id) {
      form.setValue('organizationID', singleOrganization.id, {
        shouldValidate: true,
      });
      form.setValue('projectID', 'none');
    }
  }, [
    availableOrganizations,
    organizationLocked,
    draft.hasFiles,
    pendingOrganization,
    form,
  ]);

  function changeOrganization(id: string) {
    form.setValue('projectID', 'none');
    form.setValue('organizationID', id, {
      shouldDirty: true,
      shouldValidate: true,
    });
  }

  async function confirmOrganizationChange() {
    if (!pendingOrganization || organizationLocked) {
      return;
    }
    setChangingOrganization(true);
    try {
      const result = await execPromiseWithErrorToast(
        () => draft.action.mutateAsync({ type: 'clear' }),
        {
          loadingMessage: 'Discarding draft attachments…',
          successMessage: 'Draft attachments discarded',
          errorMessage: 'Unable to update draft attachments. Please try again.',
        },
      );
      if (result === null) {
        return;
      }
      const description = form.getValues('description');
      const withoutAttachments = description.replace(
        SUPPORT_ATTACHMENT_TOKEN_PATTERN,
        (token: string, _image: string, _label: string, id: string) =>
          supportAttachmentId(`attachment:${id}`) ? '' : token,
      );
      if (withoutAttachments !== description) {
        form.setValue('description', withoutAttachments, { shouldDirty: true });
      }
      changeOrganization(pendingOrganization);
    } finally {
      setPendingOrganization(undefined);
      setChangingOrganization(false);
    }
  }
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
  const planName = selectedOrganization?.plan?.name || 'current';
  const billingHref = selectedOrganization?.slug
    ? `/orgs/${encodeURIComponent(selectedOrganization.slug)}/billing?openUpgradeModal=true`
    : undefined;
  const hasSupport = allowedSeverities.length > 0;
  const planExplanation =
    !hasSupport
      ? `Support isn't on your ${planName} plan.`
      : `Your ${planName} plan includes Low.`;
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
              if (pendingOrganization) {
                return;
              }
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
            <section>
              <fieldset className="min-w-0 rounded-t-lg border bg-background p-6">
                <legend className="sr-only">Where</legend>
                <div className="grid gap-8 lg:grid-cols-support-ticket">
                  <div className="flex items-start gap-3">
                    <span
                      aria-hidden="true"
                      className="flex size-8 shrink-0 items-center justify-center rounded-full border text-base text-muted-foreground"
                    >
                      1
                    </span>
                    <div className="space-y-1">
                      <span
                        aria-hidden="true"
                        className="block font-medium text-base"
                      >
                        Where
                      </span>
                      <p className="text-muted-foreground text-sm">
                        The project this is about.
                      </p>
                    </div>
                  </div>
                  <div className="grid min-w-0 gap-4 sm:grid-cols-2">
                    <FormField
                      control={form.control}
                      name="organizationID"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Organization</FormLabel>
                          <Select
                            name={field.name}
                            value={field.value}
                            disabled={
                              organizationLocked ||
                              availableOrganizations?.length === 1
                            }
                            onValueChange={(id) => {
                              if (id === field.value || organizationLocked) {
                                return;
                              }
                              if (draft.hasFiles) {
                                setPendingOrganization(id);
                                return;
                              }
                              changeOrganization(id);
                            }}
                          >
                            <FormControl>
                              <SelectTrigger
                                ref={organizationTrigger}
                                onBlur={field.onBlur}
                              >
                                <SelectValue placeholder="Select an organization" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {availableOrganizations?.map((organization) => (
                                <SelectItem
                                  key={organization.id}
                                  value={organization.id}
                                >
                                  {organization.name}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormSelect
                      control={form.control}
                      name="projectID"
                      label="Project"
                      disabled={
                        !selectedOrganization ||
                        selectedOrganization.apps.length === 1 ||
                        form.formState.isSubmitting
                      }
                    >
                      <SelectItem value="none">No project</SelectItem>
                      {selectedOrganization?.apps.map((project) => (
                        <SelectItem key={project.id} value={project.id}>
                          {project.name}
                        </SelectItem>
                      ))}
                    </FormSelect>
                  </div>
                </div>
              </fieldset>
              <div
                inert={!selectedOrganization}
                className={cn(
                  'rounded-b-lg border border-t-0 bg-background transition-opacity',
                  !selectedOrganization && 'opacity-20',
                )}
              >
                <fieldset
                  disabled={!selectedOrganization}
                  className="min-w-0 border-b p-6"
                >
                  <legend className="sr-only">What</legend>
                  <div className="grid gap-8 lg:grid-cols-support-ticket">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border text-base text-muted-foreground"
                      >
                        2
                      </span>
                      <div className="space-y-1">
                        <span
                          aria-hidden="true"
                          className="block font-medium text-base"
                        >
                          What
                        </span>
                        <p className="text-muted-foreground text-sm">
                          How bad is it, and which parts are affected?
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-6">
                      <FormField
                        control={form.control}
                        name="severity"
                        render={({ field }) => (
                          <FormItem>
                            <FormLabel>Severity</FormLabel>
                            <FormControl>
                              <RadioGroup
                                aria-label="Severity"
                                name={field.name}
                                value={
                                  selectedOrganization &&
                                  allowedSeverities.includes(field.value)
                                    ? field.value
                                    : ''
                                }
                                onValueChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4"
                              >
                                {SEVERITIES.map((severity) => {
                                  const locked =
                                    !selectedOrganization ||
                                    !allowedSeverities.includes(severity);
                                  const disabled =
                                    locked || form.formState.isSubmitting;
                                  const card = (
                                    <label
                                      key={severity}
                                      htmlFor={`support-severity-${severity}`}
                                      className={cn(
                                        'block h-full min-w-0 space-y-1 rounded-md border bg-muted/10 p-3 text-left transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring',
                                        locked
                                          ? 'border-dashed text-muted-foreground'
                                          : 'text-foreground',
                                        !locked && disabled &&
                                          'cursor-not-allowed opacity-60',
                                        !disabled &&
                                          'cursor-pointer hover:border-primary/50 hover:bg-muted/20',
                                        locked &&
                                          (!selectedOrganization || form.formState.isSubmitting
                                            ? 'cursor-not-allowed'
                                            : 'cursor-help hover:bg-muted/20'),
                                        !locked &&
                                          field.value === severity &&
                                          'border-primary',
                                        !disabled &&
                                          field.value === severity &&
                                          'hover:border-primary',
                                      )}
                                    >
                                      <RadioGroupItem
                                        id={`support-severity-${severity}`}
                                        value={severity}
                                        disabled={disabled}
                                        aria-label={supportLabel(severity)}
                                        aria-describedby={`support-severity-hint-${severity}`}
                                        className="sr-only"
                                      />
                                      <span className="flex items-center justify-between gap-2 font-medium text-sm">
                                        {supportLabel(severity)}
                                        {selectedOrganization && locked && (
                                          severity === SupportSeverities_Enum.Low ? (
                                            <Lock
                                              aria-hidden="true"
                                              className="size-3.5 shrink-0 text-muted-foreground"
                                            />
                                          ) : (
                                            <OrganizationPlanBadge plan="Team" />
                                          )
                                        )}
                                      </span>
                                      <span
                                        id={`support-severity-hint-${severity}`}
                                        className="block text-muted-foreground text-xs"
                                      >
                                        {severityHints[severity]}
                                      </span>
                                    </label>
                                  );
                                  return selectedOrganization && locked ? (
                                    <SeverityPlanHelp
                                      key={severity}
                                      severity={supportLabel(severity)}
                                      explanation={planExplanation}
                                      plansIntro={
                                        hasSupport
                                          ? 'Normal, High and Urgent come with:'
                                          : 'Available with:'
                                      }
                                      accessibleDescription={
                                        severity === SupportSeverities_Enum.Low
                                          ? `${supportLabel(severity)}. ${planExplanation}`
                                          : `${supportLabel(severity)}. Needs Team or Enterprise plan.`
                                      }
                                      billingHref={billingHref}
                                      onSeePlans={() => {
                                        setUpgradeOrgSlug(
                                          selectedOrganization?.slug ??
                                            undefined,
                                        );
                                      }}
                                      disabled={form.formState.isSubmitting}
                                    >
                                      {card}
                                    </SeverityPlanHelp>
                                  ) : (
                                    card
                                  );
                                })}
                              </RadioGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                      <FormField
                        control={form.control}
                        name="services"
                        render={({ field, fieldState }) => (
                          <FormItem>
                            <FormLabel>Services</FormLabel>
                            <FormControl>
                              <ToggleGroup
                                type="multiple"
                                aria-label="Services"
                                value={field.value}
                                onValueChange={field.onChange}
                                onBlur={field.onBlur}
                                ref={field.ref}
                                disabled={
                                  !selectedOrganization ||
                                  form.formState.isSubmitting
                                }
                                className="flex flex-wrap justify-start gap-2"
                              >
                                {SERVICES.map((service) => {
                                  const Icon = SERVICE_ICONS[service];
                                  return (
                                    <ToggleGroupItem
                                      key={service}
                                      value={service}
                                      className={cn(
                                        'h-9 justify-start rounded-full border bg-muted/10 px-3 text-foreground hover:border-primary/50 hover:bg-muted/20 hover:text-foreground data-[state=on]:border-primary data-[state=on]:bg-muted/10 data-[state=on]:text-foreground data-[state=on]:hover:border-primary data-[state=on]:hover:bg-muted/20',
                                        fieldState.invalid &&
                                          'border-destructive',
                                      )}
                                    >
                                      <Icon
                                        aria-hidden="true"
                                        className="size-4 shrink-0"
                                      />
                                      <span className="text-left">
                                        {supportLabel(service)}
                                      </span>
                                    </ToggleGroupItem>
                                  );
                                })}
                              </ToggleGroup>
                            </FormControl>
                            <FormMessage />
                          </FormItem>
                        )}
                      />
                    </div>
                  </div>
                </fieldset>
                <fieldset
                  disabled={!selectedOrganization}
                  className="min-w-0 border-b p-6"
                >
                  <legend className="sr-only">Details</legend>
                  <div className="grid gap-8 lg:grid-cols-support-ticket">
                    <div className="flex items-start gap-3">
                      <span
                        aria-hidden="true"
                        className="flex size-8 shrink-0 items-center justify-center rounded-full border text-base text-muted-foreground"
                      >
                        3
                      </span>
                      <div className="space-y-1">
                        <span
                          aria-hidden="true"
                          className="block font-medium text-base"
                        >
                          Details
                        </span>
                        <p className="text-muted-foreground text-sm">
                          What happened, and how can we reproduce it?
                        </p>
                      </div>
                    </div>
                    <div className="min-w-0 space-y-6">
                      <FormInput
                        control={form.control}
                        name="title"
                        label="Title"
                        disabled={
                          !selectedOrganization || form.formState.isSubmitting
                        }
                      />
                      <SupportMarkdownEditor
                        control={form.control}
                        name="description"
                        label="Description"
                        disabled={
                          !selectedOrganization || form.formState.isSubmitting
                        }
                        organizationRequired={!selectedOrganization}
                        attachmentPickerInFooter
                        onDiscardInlineAttachment={async (id) => {
                          const result = await execPromiseWithErrorToast(
                            () =>
                              draft.action.mutateAsync({ type: 'discard', id }),
                            {
                              loadingMessage: 'Removing attachment…',
                              successMessage: 'Attachment removed',
                              errorMessage:
                                'Unable to update draft attachments. Please try again.',
                            },
                          );
                          return result !== null;
                        }}
                        filesDisabled={
                          draft.busy ||
                          draft.query.isError ||
                          !!draft.query.data?.ticketID ||
                          draft.submissionUncertain
                        }
                        attachmentScope={
                          draft.identity && !draft.query.isError
                            ? { draftId: draft.identity.id }
                            : undefined
                        }
                        onFilesDrop={async (files, onUploaded) => {
                          let hasValidFile = false;
                          for (const file of files) {
                            const error = attachmentValidationError(file);
                            if (error) {
                              toast.error(error);
                            } else {
                              hasValidFile = true;
                            }
                          }
                          if (!hasValidFile) {
                            draft.addFiles(files);
                            return;
                          }
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
                              errorMessage:
                                'Unable to upload draft attachments.',
                            },
                          );
                        }}
                        attachments={(
                          insert,
                          _uploadFiles,
                          remove,
                          focusAttach,
                        ) => (
                          <DraftAttachments
                            draft={draft}
                            disabled={
                              form.formState.isSubmitting ||
                              !selectedOrganization
                            }
                            onRemoveTokens={remove}
                            focusAttach={focusAttach}
                            onRetriedUpload={insert}
                          />
                        )}
                      />
                      {draft.blocked && !draft.busy && !draft.query.isError && (
                        <p className="text-muted-foreground text-sm">
                          Upload or remove unfinished attachments before
                          creating the ticket.
                        </p>
                      )}
                    </div>
                  </div>
                </fieldset>
                <div className="flex flex-wrap items-center justify-between gap-4 p-6">
                  <p className="text-muted-foreground text-xs">
                    Visible to everyone in your organization. Don't share
                    passwords or keys.
                  </p>
                  <ButtonWithLoading
                    type="submit"
                    loading={form.formState.isSubmitting}
                    disabled={
                      !selectedOrganization ||
                      draft.blocked ||
                      !allowedSeverities.includes(selectedSeverity)
                    }
                  >
                    Create ticket
                  </ButtonWithLoading>
                </div>
              </div>
            </section>
          </Form>
          {upgradeOrgSlug && (
            <SubscriptionPlan
              key={upgradeOrgSlug}
              dialogOnly={{
                orgSlug: upgradeOrgSlug,
                onClose: () => setUpgradeOrgSlug(undefined),
              }}
            />
          )}
          <AlertDialog
            open={!!pendingOrganization}
            onOpenChange={(open) => {
              if (!open && !changingOrganization) {
                setPendingOrganization(undefined);
              }
            }}
          >
            <AlertDialogContent
              className="flex w-full max-w-lg flex-col gap-6 p-12 text-left text-foreground"
              onCloseAutoFocus={(event) => {
                event.preventDefault();
                organizationTrigger.current?.focus();
              }}
            >
              <AlertDialogHeader className="gap-2">
                <AlertDialogTitle className="text-xl">
                  Change organization?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Attached files will be removed. Your title and description
                  stay.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter className="mt-6 gap-2 sm:space-x-0">
                <AlertDialogCancel disabled={changingOrganization}>
                  Cancel
                </AlertDialogCancel>
                <ButtonWithLoading
                  type="button"
                  loading={changingOrganization}
                  disabled={organizationLocked}
                  onClick={() => {
                    void confirmOrganizationChange();
                  }}
                >
                  Remove files and change
                </ButtonWithLoading>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </FormProvider>
      )}
    </div>
  );
}
