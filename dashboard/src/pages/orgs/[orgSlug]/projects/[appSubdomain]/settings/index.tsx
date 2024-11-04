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
import { useOrgs } from '@/features/orgs/projects/hooks/useOrgs';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useBillingDeleteAppMutation,
  usePauseApplicationMutation,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
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
  const router = useRouter();
  const isPlatform = useIsPlatform();
  const { maintenanceActive } = useUI();
  const { openDialog, openAlertDialog, closeDialog } = useDialog();

  const isOwner = useIsCurrentUserOwner();
  const { currentOrg: org } = useOrgs();
  const { project, loading, refetch: refetchProject } = useProject();

  const [updateApp] = useUpdateApplicationMutation();
  const [deleteApplication] = useBillingDeleteAppMutation();
  const [pauseApplication] = usePauseApplicationMutation({
    variables: { appId: project?.id },
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

  const { register, formState } = form;

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
        appId: project.id,
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
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        await refetchProject();
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

      <SettingsContainer
        title="Pause Project"
        description="While your project is paused, it will not be accessible. You can wake it up anytime after."
        submitButtonText="Pause"
        slotProps={{
          submitButton: {
            type: 'button',
            color: 'primary',
            variant: 'contained',
            disabled: maintenanceActive || !isPlatform,
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
    <ProjectLayout>
      <SettingsLayout>
        <Container sx={{ backgroundColor: 'background.default' }}>
          {page}
        </Container>
      </SettingsLayout>
    </ProjectLayout>
  );
};
