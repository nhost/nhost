import { yupResolver } from '@hookform/resolvers/yup';
import { CogIcon, Lock, Pause, Play } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useMemo, useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';
import { UpgradeBanner } from '@/components/common/UpgradeBanner';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import { AppDialog } from '@/components/layout/AppDialog';
import {
  SectionSidebarButton,
  SectionSidebarGroup,
  SectionSidebarNav,
} from '@/components/layout/SectionSidebar';
import {
  SettingsCard,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { LoadingScreen } from '@/components/presentational/LoadingScreen';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { ProjectStatusPill } from '@/features/orgs/components/common/ProjectStatusPill';
import { TransferProject } from '@/features/orgs/components/TransferProject';
import { getProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { RemoveApplicationDialog } from '@/features/orgs/projects/common/components/RemoveApplicationDialog';
import { TOMLEditor } from '@/features/orgs/projects/common/components/settings/TOMLEditor';
import { useAppState } from '@/features/orgs/projects/common/hooks/useAppState';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { usePauseProject } from '@/features/orgs/projects/common/hooks/usePauseProject';
import { useRunServices } from '@/features/orgs/projects/common/hooks/useRunServices';
import { useUnpauseProject } from '@/features/orgs/projects/common/hooks/useUnpauseProject';
import { EnvironmentVariablesSettings } from '@/features/orgs/projects/environmentVariables/settings/components/EnvironmentVariablesSettings';
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { ResourcesForm } from '@/features/orgs/projects/resources/settings/components/ResourcesForm';
import { SecretsSettings } from '@/features/orgs/projects/secrets/settings/components/SecretsSettings';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { getLockedProjectErrorMessage } from '@/features/orgs/utils/getLockedProjectErrorMessage';
import {
  useBillingDeleteAppMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useTrackEvent } from '@/hooks/useTrackEvent';
import { ApplicationStatus } from '@/types/application';
import { getSingleQueryParam } from '@/utils/getSingleQueryParam';
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
    <aside className="flex h-full w-[200px] max-w-[200px] shrink-0 flex-col overflow-hidden border-r">
      <div className="shrink-0 border-b px-4 py-3 font-medium text-sm">
        Settings
      </div>
      <SectionSidebarNav
        ariaLabel="Project settings navigation"
        className="h-auto flex-1 overflow-auto pt-4"
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
        <UpgradeBanner section="settings-compute-resources" icon={CogIcon} />
      </div>
    );
  }

  return <ResourcesForm />;
}

export default function SettingsGeneralPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const [showPauseDialog, setShowPauseDialog] = useState(false);

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
  const { handleTriggerPausing, loading: pauseApplicationLoading } =
    usePauseProject();

  const { handleTriggerUnpausing, loading: unpauseApplicationLoading } =
    useUnpauseProject();

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

  const isPaused = state === ApplicationStatus.Paused;
  const isPausing = state === ApplicationStatus.Pausing;
  const isWakingUpOrRestoring =
    state === ApplicationStatus.Unpausing ||
    state === ApplicationStatus.Restoring;
  // Only the real transient states get the animated tag. While the request is
  // still on its way the state is unchanged, so showing the tag here would
  // render a static "Paused" / "Live" pill instead. The button carries the
  // spinner for that gap.
  // Covers every state where the project isn't fully running, so the "Wake
  // up Project" card shows for the whole pause/pausing/waking-up/restoring
  // cycle, not just Paused/Pausing. The status tag next to each card's
  // title (not this flag) is what shows the exact state to the user.
  const isPausedFamily = isPaused || isPausing || isWakingUpOrRestoring;

  const pausedDisabled = !isPlatform;

  const wakeUpDisabled = !isPlatform || isPausing;
  const { activeTab } = useGeneralSettingsTab();

  if (loading) {
    return <LoadingScreen />;
  }

  const settingsTabTitles: Record<GeneralSettingsTab, string> = {
    general: 'General',
    'compute-resources': 'Compute Resources',
    'environment-variables': 'Environment Variables',
    secrets: 'Secrets',
    editor: 'Configuration Editor',
  };

  return (
    <SettingsLayout>
      <div
        className={
          activeTab === 'editor'
            ? 'w-full px-5 py-4'
            : 'mx-auto w-full max-w-5xl px-5 py-4'
        }
      >
        <h1 className="mb-6 font-semibold text-3xl">
          {settingsTabTitles[activeTab]}
        </h1>

        {activeTab === 'general' && (
          <div className="grid grid-flow-row gap-8">
            <FormProvider {...form}>
              <Form onSubmit={handleProjectNameChange}>
                <SettingsCard>
                  {/* Same shape as Delete Project: title on top, the
                      field takes the spot description text would, and
                      Save is pinned to the right via `control`. */}
                  <SettingsCardHeader
                    title={
                      <div className="grid gap-2">
                        <h3 className="font-semibold text-xl">Project Name</h3>

                        <FormInput
                          control={form.control}
                          name="name"
                          // A percentage width collapses here: every
                          // wrapper between the header row and the input
                          // sizes itself to fit its content, so "100%" has
                          // no definite box to resolve against. A fixed
                          // width sidesteps that.
                          containerClassName="w-full sm:w-96"
                        />
                      </div>
                    }
                    control={
                      <ButtonWithLoading
                        type="submit"
                        disabled={!formState.isDirty || !isPlatform}
                        loading={formState.isSubmitting}
                      >
                        Save
                      </ButtonWithLoading>
                    }
                  />
                </SettingsCard>
              </Form>
            </FormProvider>

            <SettingsCard>
              <SettingsCardHeader
                title={
                  <span className="flex items-center gap-2">
                    <h3 className="font-semibold text-xl">Availability</h3>
                    <ProjectStatusPill status={state} />
                  </span>
                }
              />

              <div className="grid grid-flow-row gap-4 px-6">
                {isPausedFamily ? (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid gap-1">
                      <p className="font-medium">Wake up Project</p>
                      <p className="text-muted-foreground text-sm">
                        Wake up your project to make it accessible again. Once
                        reactivated, all features will be fully functional.
                      </p>
                    </div>

                    <ButtonWithLoading
                      type="button"
                      variant="outline-emboss"
                      disabled={wakeUpDisabled}
                      loading={unpauseApplicationLoading}
                      onClick={handleTriggerUnpausing}
                      className="w-full sm:w-auto"
                    >
                      <Play className="mr-2 h-4 w-4" />
                      Wake up
                    </ButtonWithLoading>
                  </div>
                ) : (
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div className="grid gap-1">
                      <p className="font-medium">Pause Project</p>
                      <p className="text-muted-foreground text-sm">
                        While your project is paused, it will not be accessible.
                        You can wake it up anytime after.
                      </p>
                    </div>

                    <ButtonWithLoading
                      type="button"
                      disabled={pausedDisabled}
                      loading={pauseApplicationLoading}
                      onClick={() => setShowPauseDialog(true)}
                      variant="outline-emboss"
                      className="w-full sm:w-auto"
                    >
                      <Pause className="mr-2 h-4 w-4" />
                      Pause
                    </ButtonWithLoading>

                    <AppDialog
                      type="confirm"
                      open={showPauseDialog}
                      onOpenChange={setShowPauseDialog}
                      title="Pause Project?"
                      primaryAction={{
                        label: (
                          <>
                            <Pause className="mr-2 h-4 w-4" />
                            Pause Project
                          </>
                        ),
                        onClick: () => {
                          handleTriggerPausing();
                          setShowPauseDialog(false);
                        },
                      }}
                    >
                      <div className="flex flex-col gap-2">
                        {showWarning ? (
                          <Alert
                            variant="warning"
                            className="flex flex-col gap-3 text-left"
                          >
                            <div className="flex flex-col gap-2 lg:flex-row lg:justify-between">
                              <p className="flex items-start gap-1 font-semibold">
                                <span>!</span> Warning: This action will delete
                                all volume data for your Run services.
                              </p>
                            </div>
                            <div className="flex flex-col gap-4">
                              <p>
                                Pausing this project will delete all persistent
                                volume data for your Run services. No automatic
                                backups are made. Please backup your data
                                manually to prevent loss. Contact{' '}
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
                    </AppDialog>
                  </div>
                )}

                <div className="border-t pt-4">
                  <TransferProject />
                </div>
              </div>
            </SettingsCard>

            {isPlatform && (
              <SettingsCard>
                <SettingsCardHeader
                  // Caps the description column so it can't stretch edge
                  // to edge and wrap right up against the Delete button.
                  // This row pairs long body copy directly against the
                  // action with no footer/divider between them, so it
                  // needs a guaranteed gap here that other cards using this
                  // same header don't.
                  contentClassName="sm:max-w-lg"
                  // Instance override, not the shared default: this
                  // keeps Delete Project's title at the same size as
                  // Availability and Project Name on this page, without
                  // bumping the text-lg default every other settings card
                  // in the app still uses for its title.
                  title={
                    <h3 className="font-semibold text-xl">Delete Project</h3>
                  }
                  description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
                  control={
                    <>
                      {!isOwner && (
                        <p className="flex items-center gap-2 text-muted-foreground text-sm">
                          <Lock className="h-4 w-4 shrink-0" />
                          Only organization admins can delete this project.
                        </p>
                      )}
                      <span
                        className={!isOwner ? 'cursor-not-allowed' : undefined}
                      >
                        <RemoveApplicationDialog
                          handler={handleDeleteApplication}
                          trigger={
                            <ButtonWithLoading
                              type="button"
                              disabled={!isOwner}
                              variant="destructive"
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
