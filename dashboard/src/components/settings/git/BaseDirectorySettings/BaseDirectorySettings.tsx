import Form from '@/components/common/Form';
import InlineCode from '@/components/common/InlineCode';
import SettingsContainer from '@/components/settings/SettingsContainer';
import { useUpdateAppMutation } from '@/generated/graphql';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Alert } from '@/ui/Alert';
import Input from '@/ui/v2/Input';
import { discordAnnounce } from '@/utils/discordAnnounce';
import { getToastStyleProps } from '@/utils/settings/settingsConstants';
import { useApolloClient } from '@apollo/client';
import { useEffect } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import { toast } from 'react-hot-toast';

export interface BaseDirectoryFormValues {
  /**
   * The relative path where the `nhost` folder is located.
   */
  nhostBaseFolder: string;
}

export default function BaseDirectorySettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();

  const form = useForm<BaseDirectoryFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      nhostBaseFolder: currentApplication?.nhostBaseFolder,
    },
  });

  const { register, formState, reset } = form;

  useEffect(() => {
    reset(() => ({
      nhostBaseFolder: currentApplication?.nhostBaseFolder,
    }));
  }, [currentApplication?.nhostBaseFolder, reset]);

  const handleBaseFolderChange = async (values: BaseDirectoryFormValues) => {
    const updateAppMutation = updateApp({
      variables: {
        id: currentApplication.id,
        app: {
          ...values,
        },
      },
    });

    await toast.promise(
      updateAppMutation,
      {
        loading: `The base directory is being updated...`,
        success: `The base directory has been updated successfully.`,
        error: `An error occurred while trying to update the project's base directory.`,
      },
      getToastStyleProps(),
    );

    form.reset(values);

    try {
      await client.refetchQueries({ include: ['getOneUser'] });
    } catch (error) {
      await discordAnnounce(
        error.message || 'Error while trying to update application cache',
      );
    }
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleBaseFolderChange}>
        <SettingsContainer
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
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/platform/github-integration#base-directory"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          {currentApplication?.githubRepository ? (
            <Input
              {...register('nhostBaseFolder')}
              name="nhostBaseFolder"
              id="nhostBaseFolder"
              className="col-span-2"
              fullWidth
              hideEmptyHelperText
            />
          ) : (
            <Alert className="col-span-5 text-left">
              To change the Base Folder, you first need to connect your project
              to a GitHub repository.
            </Alert>
          )}
        </SettingsContainer>
      </Form>{' '}
    </FormProvider>
  );
}
