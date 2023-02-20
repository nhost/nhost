import Form from '@/components/common/Form';
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

export interface DeploymentBranchFormValues {
  /**
   * The git branch to deploy from.
   */
  repositoryProductionBranch: string;
}

export default function DeploymentBranchSettings() {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [updateApp] = useUpdateAppMutation();
  const client = useApolloClient();

  const form = useForm<DeploymentBranchFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      repositoryProductionBranch:
        currentApplication?.repositoryProductionBranch,
    },
  });

  const { register, reset, formState } = form;

  useEffect(() => {
    reset(() => ({
      repositoryProductionBranch:
        currentApplication?.repositoryProductionBranch,
    }));
  }, [currentApplication?.repositoryProductionBranch, reset]);

  const handleDeploymentBranchChange = async (
    values: DeploymentBranchFormValues,
  ) => {
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
        loading: `The deployment branch is being updated...`,
        success: `The deployment branch has been updated successfully.`,
        error: `An error occurred while trying to update the project's deployment branch.`,
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
      <Form onSubmit={handleDeploymentBranchChange}>
        <SettingsContainer
          title="Deployment Branch"
          description="All commits pushed to this deployment branch will trigger a deployment. You can switch to a different branch here."
          primaryActionButtonProps={{
            disabled: !formState.isValid || !formState.isDirty,
            loading: formState.isSubmitting,
          }}
          docsLink="https://docs.nhost.io/platform/github-integration#deployment-branch"
          className="grid grid-flow-row lg:grid-cols-5"
        >
          {currentApplication?.githubRepository ? (
            <Input
              {...register('repositoryProductionBranch')}
              name="repositoryProductionBranch"
              id="repositoryProductionBranch"
              className="col-span-2"
              fullWidth
              hideEmptyHelperText
            />
          ) : (
            <Alert className="col-span-5 w-full text-left">
              To change the Deployment Branch, you first need to connect your
              project to a GitHub repository.
            </Alert>
          )}
        </SettingsContainer>
      </Form>
    </FormProvider>
  );
}
