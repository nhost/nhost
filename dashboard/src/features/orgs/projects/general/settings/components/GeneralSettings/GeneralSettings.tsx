import { yupResolver } from '@hookform/resolvers/yup';
import { Lock, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
  SettingsRow,
} from '@/components/layout/SettingsCard';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { TransferProject } from '@/features/orgs/components/TransferProject';
import { RemoveApplicationDialog } from '@/features/orgs/projects/common/components/RemoveApplicationDialog';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPauseDisabled } from '@/features/orgs/projects/common/hooks/useIsPauseDisabled';
import { useIsPausing } from '@/features/orgs/projects/common/hooks/useIsPausing';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useIsUnpauseDisabled } from '@/features/orgs/projects/common/hooks/useIsUnpauseDisabled';
import { useIsUnpausing } from '@/features/orgs/projects/common/hooks/useIsUnpausing';
import { usePauseApplication } from '@/features/orgs/projects/common/hooks/usePauseApplication';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useUnpauseApplication } from '@/features/orgs/projects/common/hooks/useUnpauseApplication';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getLockedProjectErrorMessage } from '@/features/orgs/utils/getLockedProjectErrorMessage';
import {
  useBillingDeleteAppMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { ApplicationStatus } from '@/types/application';
import { slugifyString } from '@/utils/helpers';

const projectNameValidationSchema = Yup.object({
  name: Yup.string()
    .required('This field is required.')
    .min(3, 'Must be at least 3 characters.')
    .max(32, 'Must be at most 32 characters.'),
});

export type ProjectNameValidationSchema = Yup.InferType<
  typeof projectNameValidationSchema
>;

export default function GeneralSettings() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { openAlertDialog } = useDialog();

  const isOwner = useIsCurrentUserOwner();
  const { currentOrg: org } = useOrgs();
  const { project, loading } = useProject();
  const { state } = useAppState();
  const track = useTrackEvent();

  const { services } = useRunServices();

  const showWarning = useMemo(() => {
    const isPlanFree = org?.plan?.isFree;

    if (isPlanFree) {
      return false;
    }

    return services?.some(
      (service) => (service?.config?.resources?.storage?.length ?? 0) > 0,
    );
  }, [org?.plan?.isFree, services]);

  const [updateApp] = useUpdateApplicationMutation();
  const [deleteApplication] = useBillingDeleteAppMutation();
  const { onPause, loading: pauseLoading } = usePauseApplication();
  const { onUnpause, loading: unpauseLoading } = useUnpauseApplication();
  const isPauseDisabled = useIsPauseDisabled();
  const isUnpauseDisabled = useIsUnpauseDisabled();
  const isPausing = useIsPausing();
  const isUnpausing = useIsUnpausing();

  const form = useForm<ProjectNameValidationSchema>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: project?.name,
    },
    resolver: yupResolver(projectNameValidationSchema),
    criteriaMode: 'all',
    shouldFocusError: true,
  });

  const { formState } = form;

  useEffect(() => {
    if (!loading) {
      form.reset({
        name: project?.name,
      });
    }
  }, [loading, project?.name, form]);

  async function handleProjectNameChange(data: ProjectNameValidationSchema) {
    const newProjectSlug = slugifyString(data.name);

    if (newProjectSlug.length < 1 || newProjectSlug.length > 32) {
      form.setError('name', {
        message:
          'A unique URL cannot be generated from this name. Please remove invalid characters if there are any or try a different name.',
      });

      return;
    }

    const updateAppMutation = updateApp({
      variables: {
        appId: project?.id,
        app: {
          name: data.name,
          slug: newProjectSlug,
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateAppMutation;
        form.reset({ name: data.name });
      },
      {
        loadingMessage: `Project name is being updated...`,
        successMessage: `Project name has been updated successfully.`,
        errorMessage: getLockedProjectErrorMessage(
          'An error occurred while trying to update project name.',
        ),
      },
    );
  }

  async function handleDeleteApplication() {
    await execPromiseWithErrorToast(
      async () => {
        await deleteApplication({
          variables: {
            appID: project?.id,
          },
        });
        track('Project Deleted');

        await router.push(`/orgs/${org?.slug}/projects`);
      },
      {
        loadingMessage: `Deleting ${project?.name}...`,
        successMessage: `${project?.name} has been deleted successfully.`,
        errorMessage: getLockedProjectErrorMessage(
          `An error occurred while trying to delete the project "${project?.name}". Please try again.`,
        ),
      },
    );
  }

  const showWakeUpCard =
    state === ApplicationStatus.Paused || state === ApplicationStatus.Unpausing;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="grid grid-flow-row gap-6">
      <FormProvider {...form}>
        <Form onSubmit={handleProjectNameChange}>
          <SettingsCard>
            <SettingsCardHeader
              size="lg"
              title="Project name"
              control={
                <ButtonWithLoading
                  type="submit"
                  disabled={!formState.isDirty || !isPlatform}
                  loading={formState.isSubmitting}
                  className="w-full sm:w-auto"
                >
                  Save
                </ButtonWithLoading>
              }
            >
              <FormInput
                control={form.control}
                name="name"
                aria-label="Project name"
                containerClassName="w-full sm:w-96"
              />
            </SettingsCardHeader>
          </SettingsCard>
        </Form>
      </FormProvider>

      <SettingsCard>
        <SettingsCardHeader size="lg" title="Availability" />

        <SettingsCardContent>
          {showWakeUpCard ? (
            <SettingsRow
              title="Wake up project"
              description="Wake up your project to make it accessible again. Once reactivated, all features will be fully functional."
              action={
                <ButtonWithLoading
                  type="button"
                  variant="outline"
                  disabled={isUnpauseDisabled}
                  loading={unpauseLoading || isUnpausing}
                  onClick={onUnpause}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Play />
                  {isUnpausing ? 'Waking up...' : 'Wake up'}
                </ButtonWithLoading>
              }
            />
          ) : (
            <SettingsRow
              title="Pause project"
              description="While your project is paused, it will not be accessible. You can wake it up anytime after."
              action={
                <ButtonWithLoading
                  type="button"
                  variant="outline"
                  disabled={isPauseDisabled}
                  loading={pauseLoading || isPausing}
                  onClick={() => {
                    openAlertDialog({
                      title: 'Pause Project?',
                      payload: (
                        <div className="flex flex-col gap-2">
                          {showWarning ? (
                            <Alert
                              variant="warning"
                              className="flex flex-col gap-3 text-left"
                            >
                              <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
                                <p className="flex items-start gap-1 font-semibold">
                                  Warning: This action will delete all volume
                                  data for your Run services.
                                </p>
                              </div>
                              <div className="flex flex-col gap-4">
                                <p>
                                  Pausing this project will delete all
                                  persistent volume data for your Run services.
                                  No automatic backups are made. Please backup
                                  your data manually to prevent loss. Contact{' '}
                                  <Link
                                    href="/support"
                                    target="_blank"
                                    className="text-primary-text underline"
                                    rel="noopener noreferrer"
                                  >
                                    support
                                  </Link>{' '}
                                  with any questions.
                                </p>
                              </div>
                            </Alert>
                          ) : null}
                          <p className="text-pretty">
                            Are you sure you want to pause this project? It will
                            not be accessible until you unpause it.
                          </p>
                        </div>
                      ),
                      props: {
                        maxWidth: 'sm',
                        onPrimaryAction: onPause,
                      },
                    });
                  }}
                  className="w-full gap-2 sm:w-auto"
                >
                  <Pause />
                  {isPausing ? 'Pausing...' : 'Pause'}
                </ButtonWithLoading>
              }
            />
          )}

          <TransferProject />
        </SettingsCardContent>
      </SettingsCard>

      {isPlatform && (
        <SettingsCard>
          <SettingsCardHeader
            size="lg"
            title="Delete project"
            description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
            control={
              <>
                {!isOwner && (
                  <p className="flex items-center gap-2 text-muted-foreground text-sm">
                    <Lock className="h-4 w-4 shrink-0" />
                    Only organization admins can delete this project.
                  </p>
                )}
                <span className={!isOwner ? 'cursor-not-allowed' : undefined}>
                  <RemoveApplicationDialog
                    handler={handleDeleteApplication}
                    trigger={
                      <ButtonWithLoading
                        type="button"
                        disabled={!isOwner}
                        variant="destructive"
                        className="w-full sm:w-auto"
                      >
                        Delete
                      </ButtonWithLoading>
                    }
                  />
                </span>
              </>
            }
          />
        </SettingsCard>
      )}
    </div>
  );
}
