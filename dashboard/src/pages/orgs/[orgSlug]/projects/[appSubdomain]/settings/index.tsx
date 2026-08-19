import { yupResolver } from '@hookform/resolvers/yup';
import { useQueryClient } from '@tanstack/react-query';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { TransferProject } from '@/features/orgs/components/TransferProject';
import { OrgLayout } from '@/features/orgs/layout/OrgLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { PROJECT_WITH_STATE_QUERY_KEY } from '@/features/orgs/projects/hooks/useProjectWithState';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  useBillingDeleteAppMutation,
  usePauseApplicationMutation,
  useUnpauseApplicationMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { ApplicationStatus } from '@/types/application';
import { getErrorMessageSuffix } from '@/utils/databaseErrors';
import { slugifyString } from '@/utils/helpers';

function getLockedProjectErrorMessage(genericMessage: string) {
  return (error: Error): string => {
    const lockReason = getErrorMessageSuffix(error, 'app is locked: ');
    return lockReason ? `Project is locked: ${lockReason}` : genericMessage;
  };
}

const projectNameValidationSchema = Yup.object({
  name: Yup.string()
    .required('This field is required.')
    .min(3, 'Must be at least 3 characters.')
    .max(32, 'Must be at most 32 characters.'),
});

export type ProjectNameValidationSchema = Yup.InferType<
  typeof projectNameValidationSchema
>;

type ProjectAction = 'pause' | 'unpause';
type ProjectActions = Readonly<Partial<Record<string, ProjectAction>>>;

function removeProjectAction(
  projectActions: ProjectActions,
  projectId: string,
  action: ProjectAction,
): ProjectActions {
  if (projectActions[projectId] !== action) {
    return projectActions;
  }

  const nextProjectActions = { ...projectActions };
  delete nextProjectActions[projectId];
  return nextProjectActions;
}

export default function SettingsGeneralPage() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const isPlatform = useIsPlatform();
  const { openDialog, openAlertDialog, closeDialog } = useDialog();

  const isOwner = useIsCurrentUserOwner();
  const { currentOrg: org, refetch: refetchOrgs } = useOrgs();
  const { project, loading, refetch: refetchProject } = useProject();
  const { state } = useAppState();
  const [projectActions, setProjectActions] = useState<ProjectActions>({});

  const projectAction = project?.id ? projectActions[project.id] : undefined;
  const pauseRequested = projectAction === 'pause';
  const unpauseRequested = projectAction === 'unpause';
  const isPaused = state === ApplicationStatus.Paused;
  const isPausing = state === ApplicationStatus.Pausing;

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
  const [pauseApplication] = usePauseApplicationMutation();
  const [unpauseApplication] = useUnpauseApplicationMutation();

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
        await Promise.all([refetchOrgs(), refetchProject()]);
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

  async function handlePauseApplication() {
    const projectId = project?.id;
    const projectSubdomain = project?.subdomain;
    const projectName = project?.name;

    if (!projectId || !projectSubdomain || !projectName || pauseRequested) {
      return;
    }

    setProjectActions((currentProjectActions) => ({
      ...currentProjectActions,
      [projectId]: 'pause',
    }));

    try {
      await execPromiseWithErrorToast(
        async () => {
          await pauseApplication({ variables: { appId: projectId } });
          await new Promise((resolve) => {
            setTimeout(resolve, 1000);
          });
          await queryClient.invalidateQueries({
            queryKey: [PROJECT_WITH_STATE_QUERY_KEY, projectSubdomain],
          });
        },
        {
          loadingMessage: `Pausing ${projectName}...`,
          successMessage: `${projectName} will be paused, but please note that it may take some time to complete the process.`,
          errorMessage: getLockedProjectErrorMessage(
            `An error occurred while trying to pause the project "${projectName}". Please try again.`,
          ),
        },
      );
    } finally {
      setProjectActions((currentProjectActions) =>
        removeProjectAction(currentProjectActions, projectId, 'pause'),
      );
    }
  }

  async function handleTriggerUnpausing() {
    const projectId = project?.id;
    const projectSubdomain = project?.subdomain;
    const projectName = project?.name;

    if (!projectId || !projectSubdomain || !projectName || unpauseRequested) {
      return;
    }

    setProjectActions((currentProjectActions) => ({
      ...currentProjectActions,
      [projectId]: 'unpause',
    }));

    try {
      await execPromiseWithErrorToast(
        async () => {
          await unpauseApplication({ variables: { appId: projectId } });
          await new Promise((resolve) => {
            setTimeout(resolve, 1000);
          });
          await queryClient.invalidateQueries({
            queryKey: [PROJECT_WITH_STATE_QUERY_KEY, projectSubdomain],
          });
        },
        {
          loadingMessage: `Starting ${projectName}...`,
          successMessage: `${projectName} has been started successfully.`,
          errorMessage: getUnpauseErrorMessage,
        },
      );
    } finally {
      setProjectActions((currentProjectActions) =>
        removeProjectAction(currentProjectActions, projectId, 'unpause'),
      );
    }
  }

  const pausedDisabled = !isPlatform || pauseRequested;
  const wakeUpDisabled = !isPlatform || unpauseRequested || isPausing;

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <div className="grid grid-flow-row gap-8">
      <FormProvider {...form}>
        <Form onSubmit={handleProjectNameChange}>
          <SettingsCard>
            <SettingsCardHeader
              title="Project Name"
              description="The name of the project."
            />

            <SettingsCardContent className="lg:grid-cols-4">
              <FormInput
                control={form.control}
                name="name"
                label="Project Name"
                containerClassName="col-span-2"
              />
            </SettingsCardContent>

            <SettingsCardFooter>
              <ButtonWithLoading
                type="submit"
                disabled={!formState.isDirty || !isPlatform}
                loading={formState.isSubmitting}
                className="w-full sm:w-auto"
              >
                Save
              </ButtonWithLoading>
            </SettingsCardFooter>
          </SettingsCard>
        </Form>
      </FormProvider>

      {isPaused || isPausing ? (
        <SettingsCard>
          <SettingsCardHeader
            title="Wake up Project"
            description="Wake up your project to make it accessible again. Once reactivated, all features will be fully functional."
          />

          <SettingsCardFooter>
            <ButtonWithLoading
              type="button"
              disabled={wakeUpDisabled}
              loading={unpauseRequested || isPausing}
              onClick={handleTriggerUnpausing}
              className="w-full sm:w-auto"
            >
              {isPausing ? 'Pausing...' : 'Wake up'}
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      ) : null}

      {!isPaused && !isPausing && (
        <SettingsCard>
          <SettingsCardHeader
            title="Pause Project"
            description="While your project is paused, it will not be accessible. You can wake it up anytime after."
          />

          <SettingsCardFooter>
            <ButtonWithLoading
              type="button"
              disabled={pausedDisabled}
              loading={pauseRequested}
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
                              <span>⚠</span> Warning: This action will delete
                              all volume data for your Run services.
                            </p>
                          </div>
                          <div className="flex flex-col gap-4">
                            <p>
                              Pausing this project will delete all persistent
                              volume data for your Run services. No automatic
                              backups are made. Please backup your data manually
                              to prevent loss. Contact{' '}
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
                        Are you sure you want to pause this project? It will not
                        be accessible until you unpause it.
                      </p>
                    </div>
                  ),
                  props: {
                    maxWidth: 'sm',
                    onPrimaryAction: handlePauseApplication,
                  },
                });
              }}
              className="w-full sm:w-auto"
            >
              Pause
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      )}

      <TransferProject />

      {isPlatform && (
        <SettingsCard className="border-destructive">
          <SettingsCardHeader
            title="Delete Project"
            description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
          />

          <SettingsCardFooter>
            {!isOwner && (
              <p className="flex items-center gap-2 text-muted-foreground text-sm sm:mr-auto">
                <Lock className="h-4 w-4 shrink-0" />
                Only organization admins can delete this project.
              </p>
            )}
            <span className={!isOwner ? 'cursor-not-allowed' : undefined}>
              <ButtonWithLoading
                type="button"
                disabled={!isOwner}
                onClick={() => {
                  openDialog({
                    component: (
                      <RemoveApplicationModal
                        close={closeDialog}
                        handler={handleDeleteApplication}
                      />
                    ),
                    props: {
                      PaperProps: { className: 'max-w-sm' },
                    },
                  });
                }}
                variant="destructive"
                className="w-full sm:w-auto"
              >
                Delete
              </ButtonWithLoading>
            </span>
          </SettingsCardFooter>
        </SettingsCard>
      )}
    </div>
  );
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <OrgLayout>
      <SettingsLayout>
        <div className="mx-auto w-full max-w-5xl px-5 py-4">{page}</div>
      </SettingsLayout>
    </OrgLayout>
  );
};
