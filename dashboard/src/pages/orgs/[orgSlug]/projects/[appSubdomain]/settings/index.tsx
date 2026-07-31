import { yupResolver } from '@hookform/resolvers/yup';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { type ReactElement, useEffect, useMemo } from 'react';
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
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationsDocument,
  useBillingDeleteAppMutation,
  usePauseApplicationMutation,
  useUnpauseApplicationMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
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

export default function SettingsGeneralPage() {
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { openDialog, openAlertDialog, closeDialog } = useDialog();

  const isOwner = useIsCurrentUserOwner();
  const { currentOrg: org } = useOrgs();
  const userData = useUserData();
  const { project, loading, refetch: refetchProject } = useProject();
  const { state } = useAppState();

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
        errorMessage: `An error occurred while trying to update project name.`,
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
        errorMessage: `An error occurred while trying to delete the project "${project?.name}". Please try again.`,
      },
    );
  }

  async function handlePauseApplication() {
    await execPromiseWithErrorToast(
      async () => {
        await pauseApplication();
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: `Pausing ${project?.name}...`,
        successMessage: `${project?.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: `An error occurred while trying to pause the project "${project?.name}". Please try again.`,
      },
    );
  }

  async function handleTriggerUnpausing() {
    await execPromiseWithErrorToast(
      async () => {
        await unpauseApplication();
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
      },
      {
        loadingMessage: 'Starting the project...',
        successMessage: 'The project has been started successfully.',
        errorMessage:
          'An error occurred while waking up the project. Please try again.',
      },
    );
  }
  const isPaused = state === ApplicationStatus.Paused;
  const isPausing = state === ApplicationStatus.Pausing;

  const pausedDisabled = !isPlatform || pauseApplicationLoading;

  const wakeUpDisabled = !isPlatform || unpauseApplicationLoading || isPausing;

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

      {isOwner && (
        <SettingsCard className="border-destructive">
          <SettingsCardHeader
            title="Delete Project"
            description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
          />

          <SettingsCardFooter>
            <ButtonWithLoading
              type="button"
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
