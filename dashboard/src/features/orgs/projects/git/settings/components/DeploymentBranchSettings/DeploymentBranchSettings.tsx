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

export interface DeploymentBranchFormValues {
  /**
   * The git branch to deploy from.
   */
  repositoryProductionBranch: string;
}

export default function DeploymentBranchSettings() {
  const { project } = useProject();
  const [updateApp] = useUpdateApplicationMutation();
  const userData = useUserData();

  const form = useForm<DeploymentBranchFormValues>({
    reValidateMode: 'onSubmit',
    defaultValues: {
      repositoryProductionBranch: project?.repositoryProductionBranch,
    },
  });

  const { reset, formState } = form;

  useEffect(() => {
    if (isNotEmptyValue(project?.repositoryProductionBranch)) {
      reset(() => ({
        repositoryProductionBranch: project?.repositoryProductionBranch,
      }));
    }
  }, [project?.repositoryProductionBranch, reset]);

  const handleDeploymentBranchChange = async (
    values: DeploymentBranchFormValues,
  ) => {
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
        loadingMessage: 'The deployment branch is being updated...',
        successMessage: 'The deployment branch has been updated successfully.',
        errorMessage:
          'An error occurred while trying to create the permission variable.',
      },
    );
  };

  return (
    <FormProvider {...form}>
      <Form onSubmit={handleDeploymentBranchChange}>
        <SettingsCard>
          <SettingsCardHeader
            title="Deployment Branch"
            description="When automatic deploys are enabled, commits pushed to this branch will trigger a deployment. You can switch to a different branch here."
          />

          <SettingsCardContent className="lg:grid-cols-5">
            {project?.githubRepository ? (
              <FormInput
                control={form.control}
                name="repositoryProductionBranch"
                containerClassName="col-span-2"
                disabled={!project?.automaticDeploys}
              />
            ) : (
              <Alert className="col-span-5 w-full text-left">
                To change the Deployment Branch, you first need to connect your
                project to a GitHub repository.
              </Alert>
            )}
          </SettingsCardContent>

          <SettingsCardFooter>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/deployments#deployment-branch"
              title="Deployment Branch"
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
