import { RemoveApplicationModal } from '@/components/applications/RemoveApplicationModal';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import { useUI } from '@/context/UIContext';
import {
  useDeleteApplicationMutation,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Input from '@/ui/v2/Input';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { slugifyString } from '@/utils/helpers';
import getServerError from '@/utils/settings/getServerError';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { updateOwnCache } from '@/utils/updateOwnCache';
import { useApolloClient } from '@apollo/client';
import { yupResolver } from '@hookform/resolvers/yup';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';
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
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openDialog, closeDialog } = useDialog();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();
  const [deleteApplication] = useDeleteApplicationMutation({
    variables: { appId: currentApplication?.id },
  });
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const router = useRouter();
  const { projectManagementDisabled } = useUI();

  const form = useForm<ProjectNameValidationSchema>({
    mode: 'onSubmit',
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: currentApplication?.name,
    },
    resolver: yupResolver(projectNameValidationSchema),
    criteriaMode: 'all',
    shouldFocusError: true,
  });

  const { register, formState } = form;

  const handleProjectNameChange = async (data: ProjectNameValidationSchema) => {
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
        id: currentApplication.id,
        app: {
          name: data.name,
          slug: newProjectSlug,
        },
      },
    });

    try {
      await toast.promise(
        updateAppMutation,
        {
          loading: `Project name is being updated...`,
          success: `Project name has been updated successfully.`,
          error: getServerError(
            `An error occurred while trying to update project name.`,
          ),
        },
        getToastStyleProps(),
      );
    } catch {
      // Note: The toast will handle the error.
    }

    try {
      await client.refetchQueries({
        include: ['getOneUser'],
      });
      form.reset(undefined, { keepValues: true, keepDirty: false });
      await router.push(
        `/${currentWorkspace.slug}/${newProjectSlug}/settings/general`,
      );
    } catch (error) {
      await discordAnnounce(
        error.message || 'Error while trying to update application cache',
      );
    }
  };

  const handleDeleteApplication = async () => {
    await toast.promise(
      deleteApplication(),
      {
        loading: `Deleting ${currentApplication.name}...`,
        success: `${currentApplication.name} deleted`,
        error: getServerError(
          `Error while trying to ${currentApplication.name} project name`,
        ),
      },
      getToastStyleProps(),
    );
    await router.push('/');
    await updateOwnCache(client);
  };

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
                disabled: !formState.isDirty || projectManagementDisabled,
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
            disabled: projectManagementDisabled,
            onClick: () => {
              openDialog({
                title: '',
                component: (
                  <RemoveApplicationModal
                    close={closeDialog}
                    handler={handleDeleteApplication}
                  />
                ),
                props: {
                  PaperProps: { className: 'max-w-sm' },
                  hideTitle: true,
                },
              });
            },
          },
        }}
      />
    </Container>
  );
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return <SettingsLayout>{page}</SettingsLayout>;
};
