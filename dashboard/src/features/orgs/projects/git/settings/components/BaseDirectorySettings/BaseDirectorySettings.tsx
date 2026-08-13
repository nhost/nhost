import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { Form } from '@/components/form/Form';
import { FormInput } from '@/components/form/FormInput';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';
import { InlineCode } from '@/components/presentational/InlineCode';
import { Alert } from '@/components/ui/v3/alert';
import { ButtonWithLoading } from '@/components/ui/v3/button';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  GetOrganizationsDocument,
  useUpdateApplicationMutation,
} from '@/generated/graphql';
import { useUserData } from '@/hooks/useUserData';
import { isNotEmptyValue } from '@/lib/utils';

export interface BaseDirectoryFormValues {
  /**
   * The relative path where the `nhost` folder is located.
   */
  nhostBaseFolder: string;
}

export default function BaseDirectorySettings() {
  const { project } = useProject();
  const [updateApp] = useUpdateApplicationMutation();
  const userData = useUserData();

  const form = useForm<BaseDirectoryFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      nhostBaseFolder: project?.nhostBaseFolder,
    },
  });

  const { formState, reset } = form;

  useEffect(() => {
    if (isNotEmptyValue(project?.nhostBaseFolder)) {
      reset(() => ({
        nhostBaseFolder: project?.nhostBaseFolder,
      }));
    }
  }, [project?.nhostBaseFolder, reset]);

  const handleBaseFolderChange = async (values: BaseDirectoryFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        appId: project?.id,
        app: {
          ...values,
        },
      },
      refetchQueries: [
        {
          query: GetOrganizationsDocument,
          variables: { userId: userData?.id },
        },
      ],
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateAppMutation;
        form.reset(values);
      },
      {
        loadingMessage: 'The base directory is being updated...',
        successMessage: 'The base directory has been updated successfully.',
        errorMessage:
          "An error occurred while trying to update the project's base directory.",
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleBaseFolderChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Base Directory"
            description={
              <>
                The base directory is where the{' '}
                <InlineCode className="text-xs">nhost</InlineCode> directory is
                located. In other words, the base directory is the parent
                directory of the{' '}
                <InlineCode className="text-xs">nhost</InlineCode> folder.
              </>
            }
          />

          <SettingsCardContent className="lg:grid-cols-5">
            {project?.githubRepository ? (
              <FormInput
                control={form.control}
                name="nhostBaseFolder"
                containerClassName="col-span-2"
                disabled={!project?.automaticDeploys}
              />
            ) : (
              <Alert className="col-span-5 text-left">
                To change the Base Folder, you first need to connect your
                project to a GitHub repository.
              </Alert>
            )}
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/deployments#base-directory"
              title="Base Directory"
            />

            <ButtonWithLoading
              type="submit"
              disabled={!formState.isDirty || !project?.automaticDeploys}
              loading={formState.isSubmitting}
              className="w-full sm:w-auto"
            >
              Save
            </ButtonWithLoading>
          </SettingsCardFooter>
        </SettingsCard>
      </Form>
    </FormProvider>
  );
}
