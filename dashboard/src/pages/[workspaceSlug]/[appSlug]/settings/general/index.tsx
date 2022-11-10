import { RemoveApplicationModal } from '@/components/applications/RemoveApplicationModal';
import { useDialog } from '@/components/common/DialogProvider';
import Form from '@/components/common/Form';
import Container from '@/components/layout/Container';
import SettingsContainer from '@/components/settings/SettingsContainer';
import SettingsLayout from '@/components/settings/SettingsLayout';
import {
  useDeleteApplicationMutation,
  useUpdateAppMutation,
} from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import CheckIcon from '@/ui/v2/icons/CheckIcon';
import Input from '@/ui/v2/Input';
import { discordAnnounce } from '@/utils/discordAnnounce';
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

const toastStyleProps = {
  style: {
    minWidth: '250px',
    backgroundColor: 'rgb(33 50 75)',
    color: '#fff',
  },
  success: {
    duration: 5000,
    icon: <CheckIcon className="h-4 w-4 bg-transparent" />,
  },
};

export default function SettingsGeneralPage() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const { openAlertDialog, closeAlertDialog } = useDialog();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();
  const [deleteApplication] = useDeleteApplicationMutation({
    variables: { appId: currentApplication?.id },
  });
  const router = useRouter();

  const form = useForm<ProjectNameValidationSchema>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      name: currentApplication?.name,
    },
    resolver: yupResolver(projectNameValidationSchema),
    mode: 'onSubmit',
    criteriaMode: 'all',
    shouldFocusError: true,
  });

  const { register, formState } = form;

  const handleProjectNameChange = async (data: ProjectNameValidationSchema) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...data,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `Project name is being updated...`,
        success: `Project name updated`,
        error: `Error while trying to update project name`,
      },
      toastStyleProps,
    );
    try {
      await client.refetchQueries({ include: ['getOneUser'] });
      form.reset(undefined, { keepValues: true, keepDirty: false });
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
        error: `Error while trying to ${currentApplication.name} project name`,
      },
      toastStyleProps,
    );
    await router.push('/');
    await updateOwnCache(client);
  };

  return (
    <Container
      className="grid grid-flow-row gap-8 bg-transparent"
      wrapperClassName="bg-fafafa"
    >
      <SettingsContainer
        title="Project Name"
        description="The name of the project."
        formId="project-name"
        primaryActionButtonProps={{
          disabled:
            formState.isSubmitting || !formState.isValid || !formState.isDirty,
        }}
      >
        <FormProvider {...form}>
          <Form
            onSubmit={handleProjectNameChange}
            id="project-name"
            className="grid grid-flow-row px-4 lg:grid-cols-4"
          >
            <Input
              {...register('name')}
              className="col-span-2"
              variant="inline"
              fullWidth
              hideEmptyHelperText
              componentsProps={{
                helperText: {
                  className: 'col-start-1',
                },
              }}
            />
          </Form>
        </FormProvider>
      </SettingsContainer>
      <SettingsContainer
        title="Delete Project"
        description="The project will be permanently deleted, including its database, metadata, files, etc. This action is irreversible and can not be undone."
        submitButtonText="Delete"
        className="border-[#F87171]"
        primaryActionButtonProps={{
          color: 'error',
          variant: 'contained',
          onClick: () => {
            openAlertDialog({
              title: `Are you sure you want to remove ${currentApplication?.name}?`,
              payload: (
                <RemoveApplicationModal
                  close={closeAlertDialog}
                  handler={handleDeleteApplication}
                />
              ),
              props: {
                primaryButtonText: 'Delete',
                primaryButtonColor: 'error',
                maxWidth: 'lg',
                hideTitle: true,
                hidePrimaryAction: true,
                hideSecondaryAction: true,
              },
            });
          },
        }}
      />
    </Container>
  );
}

SettingsGeneralPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <SettingsLayout
      mainContainerProps={{
        className: 'bg-fafafa',
      }}
    >
      {page}
    </SettingsLayout>
  );
};
