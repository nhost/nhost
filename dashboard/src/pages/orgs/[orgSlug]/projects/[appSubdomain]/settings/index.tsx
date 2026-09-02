import { yupResolver } from '@hookform/resolvers/yup';
import { Lock } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useMemo } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { useDialog } from '@/components/common/DialogProvider';
import { UpgradeToProBanner } from '@/components/common/UpgradeToProBanner';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
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
import { getProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { RemoveApplicationDialog } from '@/features/orgs/projects/common/components/RemoveApplicationDialog';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { EnvironmentVariablesSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariablesSettings';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';
import { SecretsSettings } from '@/features/orgs/projects/secrets/settings/components/SecretsSettings';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getUnpauseErrorMessage } from '@/features/orgs/utils/getUnpauseErrorMessage';
import {
  GetOrganizationsDocument,
  useBillingDeleteAppMutation,
  usePauseApplicationMutation,
  useUnpauseApplicationMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { useUserData } from '@/hooks/useUserData';
import { ApplicationStatus } from '@/types/application';
import { getErrorMessageSuffix } from '@/utils/databaseErrors';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
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

type GeneralSettingsTab =
  | 'general'
  | 'compute-resources'
  | 'environment-variables'
  | 'secrets'
  | 'editor';

const GENERAL_SETTINGS_DEFAULT_TAB: GeneralSettingsTab = 'general';

function isGeneralSettingsTab(
  value: string | undefined,
): value is GeneralSettingsTab {
  return (
    value === 'general' ||
    value === 'compute-resources' ||
    value === 'environment-variables' ||
    value === 'secrets' ||
    value === 'editor'
  );
}

function getGeneralSettingsTab(
  value: string | string[] | undefined,
): GeneralSettingsTab {
  const tab = getSingleQueryParam(value);

  if (!isGeneralSettingsTab(tab)) {
    return GENERAL_SETTINGS_DEFAULT_TAB;
  }

  return tab;
}

function useGeneralSettingsTab() {
  const router = useRouter();
  const activeTab = getGeneralSettingsTab(router.query.tab);

  function setActiveTab(nextTab: GeneralSettingsTab) {
    const nextQuery = { ...router.query };

    if (nextTab === GENERAL_SETTINGS_DEFAULT_TAB) {
      delete nextQuery.tab;
    } else {
      nextQuery.tab = nextTab;
    }

    void router.replace(
      {
        pathname: router.pathname,
        query: nextQuery,
      },
      undefined,
      { shallow: true, scroll: false },
    );
  }

  return { activeTab, setActiveTab };
}

function GeneralSettingsSidebar() {
  const { activeTab, setActiveTab } = useGeneralSettingsTab();

  return (
    <aside className="flex h-full w-[280px] max-w-[280px] shrink-0 flex-col overflow-hidden border-r bg-background-default">
      <div className="shrink-0 border-b px-4 py-3 font-medium text-sm">
        Settings
      </div>
      <SectionSidebarNav
        ariaLabel="Project settings navigation"
        className="h-auto flex-1 overflow-auto"
      >
        <SectionSidebarGroup label="PROJECT">
          <SectionSidebarButton
            active={activeTab === 'general'}
            onClick={() => setActiveTab('general')}
          >
            General
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'compute-resources'}
            onClick={() => setActiveTab('compute-resources')}
          >
            Compute Resources
          </SectionSidebarButton>
        </SectionSidebarGroup>

        <div className="mx-3 h-px bg-border" />

        <SectionSidebarGroup label="CONFIGURATION">
          <SectionSidebarButton
            active={activeTab === 'environment-variables'}
            onClick={() => setActiveTab('environment-variables')}
          >
            Environment Variables
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'secrets'}
            onClick={() => setActiveTab('secrets')}
          >
            Secrets
          </SectionSidebarButton>
          <SectionSidebarButton
            active={activeTab === 'editor'}
            onClick={() => setActiveTab('editor')}
          >
            Configuration Editor
          </SectionSidebarButton>
        </SectionSidebarGroup>
      </SectionSidebarNav>
    </aside>
  );
}

interface ComputeResourcesSettingsProps {
  isFree?: boolean;
}

function ComputeResourcesSettings({ isFree }: ComputeResourcesSettingsProps) {
  if (isFree) {
    return (
      <div className="grid grid-flow-row gap-6">
        <UpgradeToProBanner
          section="settings-compute-resources"
          title="To unlock Compute Resources, transfer this project to a Pro or Team organization."
          description=""
        />
      </div>
    );
  }

  return <ResourcesForm />;
}

export default function SettingsGeneralPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { openAlertDialog } = useDialog();

  const isOwner = useIsCurrentUserOwner();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();
  const { project, loading, refetch: refetchProject } = useProject();
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
  const [pauseApplication, { loading: pauseApplicationLoading }] =
    usePauseApplicationMutation({
      variables: { appId: project?.id },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

  const [unpauseApplication, { loading: unpauseApplicationLoading }] =
    useUnpauseApplicationMutation({
      variables: { appId: project?.id },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

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

  async function handlePauseApplication() {
    await execPromiseWithErrorToast(
      async () => {
        await pauseApplication();
        track('Project Paused', { reason: 'manual' });
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: `Pausing ${project?.name}...`,
        successMessage: `${project?.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: getLockedProjectErrorMessage(
          `An error occurred while trying to pause the project "${project?.name}". Please try again.`,
        ),
      },
    );
  }

  async function handleTriggerUnpausing() {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication();
        track('Project Resumed');
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage: getUnpauseErrorMessage,
      },
    );
  }
  const isPaused = state === ApplicationStatus.Paused;
  const isPausing = state === ApplicationStatus.Pausing;

  const pausedDisabled = !isPlatform || pauseApplicationLoading;

  const wakeUpDisabled = !isPlatform || unpauseApplicationLoading || isPausing;
  const { activeTab } = useGeneralSettingsTab();

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <SettingsLayout>
      <div
        className={
          activeTab === 'editor'
            ? 'w-full px-5 py-4'
            : 'mx-auto w-full max-w-5xl px-5 py-4'
        }
      >
        {activeTab === 'general' && (
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
                    loading={unpauseApplicationLoading || isPausing}
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
                    loading={pauseApplicationLoading}
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
                                    <span>!</span> Warning: This action will
                                    delete all volume data for your Run
                                    services.
                                  </p>
                                </div>
                                <div className="flex flex-col gap-4">
                                  <p>
                                    Pausing this project will delete all
                                    persistent volume data for your Run
                                    services. No automatic backups are made.
                                    Please backup your data manually to prevent
                                    loss. Contact{' '}
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
                              Are you sure you want to pause this project? It
                              will not be accessible until you unpause it.
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
                </SettingsCardFooter>
              </SettingsCard>
            )}
          </div>
        )}

        {activeTab === 'compute-resources' && (
          <ComputeResourcesSettings isFree={org?.plan?.isFree} />
        )}

        {activeTab === 'environment-variables' && (
          <EnvironmentVariablesSettings />
        )}

        {activeTab === 'secrets' && <SecretsSettings />}

        {activeTab === 'editor' && <TOMLEditor />}
      </div>
    </SettingsLayout>
  );
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return getProjectLayout(page, {
    sidebar: <GeneralSettingsSidebar />,
    bodyClassName: 'w-full',
    contentClassName: 'flex flex-col',
  });
};
