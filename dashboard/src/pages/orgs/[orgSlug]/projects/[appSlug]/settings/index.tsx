import { useDialog } from '@/components/common/DialogProvider';
import { useUI } from '@/components/common/UIProvider';
import { Form } from '@/components/form/Form';
import { Container } from '@/components/layout/Container';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Input } from '@/components/ui/v2/Input';
import { TransferProject } from '@/features/orgs/components/TransferProject';
import { ProjectLayout } from '@/features/orgs/layout/ProjectLayout';
import { SettingsLayout } from '@/features/orgs/layout/SettingsLayout';
import { RemoveApplicationModal } from '@/features/orgs/projects/common/components/RemoveApplicationModal';
import { useIsCurrentUserOwner } from '@/features/orgs/projects/common/hooks/useIsCurrentUserOwner';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetAllWorkspacesAndProjectsDocument,
  useBillingDeleteAppMutation,
  usePauseApplicationMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { slugifyString } from '@/utils/helpers';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import * as Yup from 'yup';

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
  const { org } = useCurrentOrg();
  const { project, loading, refetch: refetchProject } = useProject();

  const isOwner = useIsCurrentUserOwner();
  const { openDialog, openAlertDialog, closeDialog } = useDialog();
  const [updateApp] = useUpdateApplicationMutation();
  const [pauseApplication] = usePauseApplicationMutation({
    variables: { appId: project?.id },
    refetchQueries: [{ query: GetAllWorkspacesAndProjectsDocument }],
  });
  const [deleteApplication] = useBillingDeleteAppMutation();
  const router = useRouter();
  const { maintenanceActive } = useUI();

  const isPlatform = useIsPlatform();

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

  const { register, formState } = form;

  async function handleProjectNameChange(data: ProjectNameValidationSchema) {
    // In this bit of code we spread the props of the current path (e.g. /workspace/...) and add one key-value pair: `updating: true`.
    // We want to indicate that the currently we're in the process of running a mutation state that will affect the routing behaviour of the website
    // i.e. redirecting to 404 if there's no workspace/project with that slug.
    await router.replace({
      pathname: router.pathname,
      query: { ...router.query, updating: true },
    });

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
        appId: project.id,
        app: {
          name: data.name,
          slug: newProjectSlug,
        },
      },
    });

    try {
      const { data: updateAppData } = await execPromiseWithErrorToast(
        async () => updateAppMutation,
        {
          loadingMessage: `Project name is being updated...`,
          successMessage: `Project name has been updated successfully.`,
          errorMessage: `An error occurred while trying to update project name.`,
        },
      );

      const updateAppResult = updateAppData?.updateApp;

      if (!updateAppResult) {
        await discordAnnounce('Failed to update project name.');

        return;
      }

      form.reset(undefined, { keepValues: true, keepDirty: false });

      await refetchProject();
      await router.replace(
        `/orgs/${org?.slug}/projects/${updateAppResult?.slug}/settings`,
      );
    } catch {
      // Note: The toast will handle the error.
    }
  }

  async function handleDeleteApplication() {
    await execPromiseWithErrorToast(
      async () => {
        await deleteApplication({
          variables: {
            appID: project?.id,
          },
        });

        await router.push(`/orgs/${org.slug}/projects`);
      },
      {
        loadingMessage: `Deleting ${project.name}...`,
        successMessage: `${project.name} has been deleted successfully.`,
        errorMessage: `An error occurred while trying to delete the project "${project.name}". Please try again.`,
      },
    );
  }

  async function handlePauseApplication() {
    await execPromiseWithErrorToast(
      async () => {
        await pauseApplication();
        await router.push('/');
      },
      {
        loadingMessage: `Pausing ${project.name}...`,
        successMessage: `${project.name} will be paused, but please note that it may take some time to complete the process.`,
        errorMessage: `An error occurred while trying to pause the project "${project.name}". Please try again.`,
      },
    );
  }

  if (loading) {
    return <ActivityIndicator label="Loading project..." />;
  }

  return (
    <Container
      className="grid max-w-5xl grid-flow-row gap-8 bg-transparent"
      rootClassName="bg-transparent"
    >
      <FormProvider {...form}>
        <Form onSubmit={handleProjectNameChange}>
          <SettingsContainer
            title="Project Name"
            description="The name of the project."
            className="grid grid-flow-row px-4 lg:grid-cols-4"
            slotProps={{
              submitButton: {
                disabled:
                  !formState.isDirty || maintenanceActive || !isPlatform,
                loading: formState.isSubmitting,
              },
            }}
          >
            <Input
              {...register('name')}
              className="col-span-2"
              variant="inline"
              fullWidth
              hideEmptyHelperText
              helperText={formState.errors.name?.message}
              error={Boolean(formState.errors.name)}
              slotProps={{
                helperText: { className: 'col-start-1' },
              }}
            />
          </SettingsContainer>
        </Form>
      </FormProvider>

      {org?.plan?.isFree && (
        <SettingsContainer
          title="Pause Project"
          description="While your project is paused, it will not be accessible. You can wake it up anytime after."
          submitButtonText="Pause"
          slotProps={{
            submitButton: {
              type: 'button',
              color: 'primary',
              variant: 'contained',
              disabled: maintenanceActive,
              onClick: () => {
                openAlertDialog({
                  title: 'Pause Project?',
                  payload:
                    'Are you sure you want to pause this project? It will not be accessible until you unpause it.',
                  props: {
                    onPrimaryAction: handlePauseApplication,
                  },
                });
              },
            },
          }}
        />
      )}

      <TransferProject />

      {isOwner && (
        <SettingsContainer
          title="Delete Project"
          description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
          submitButtonText="Delete"
          slotProps={{
            root: {
              sx: { borderColor: (theme) => theme.palette.error.main },
            },
            submitButton: {
              type: 'button',
              color: 'error',
              variant: 'contained',
              disabled: maintenanceActive,
              onClick: () => {
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
              },
            },
          }}
        />
      )}
    </Container>
  );
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <ProjectLayout
      mainContainerProps={{
        className: 'flex h-full',
      }}
    >
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
