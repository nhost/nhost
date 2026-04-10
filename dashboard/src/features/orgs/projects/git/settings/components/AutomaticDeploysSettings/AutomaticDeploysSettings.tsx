import { useUI } from '@/components/common/UIProvider';
import { SettingsContainer } from '@/components/layout/SettingsContainer';
import { Alert } from '@/components/ui/v2/Alert';
import { Switch } from '@/components/ui/v3/switch';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useUpdateApplicationMutation } from '@/utils/__generated__/graphql';

export default function AutomaticDeploysSettings() {
  const { maintenanceActive } = useUI();
  const { project, refetch } = useProject();
  const [updateApp] = useUpdateApplicationMutation();

  const handleToggle = async (checked: boolean) => {
    const updateAppMutation = updateApp({
      variables: {
        appId: project?.id,
        app: {
          automaticDeploys: checked,
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateAppMutation;
        await refetch();
      },
      {
        loadingMessage: 'Updating automatic deploys setting...',
        successMessage: `Automatic deploys ${checked ? 'enabled' : 'disabled'}.`,
        errorMessage:
          'An error occurred while updating the automatic deploys setting.',
      },
    );
  };

  return (
    <SettingsContainer
      title="Automatic Deploys"
      description="When enabled, commits pushed to the deployment branch will automatically trigger a deployment. When disabled, deployments must be triggered manually via the CLI or GitHub Actions."
      docsLink="https://docs.nhost.io/platform/cloud/git"
      slotProps={{ submitButton: { className: 'hidden' } }}
      className="grid grid-flow-row lg:grid-cols-5"
    >
      {project?.githubRepository ? (
        <div className="col-span-5 flex items-center gap-3">
          <Switch
            checked={project?.automaticDeploys ?? true}
            onCheckedChange={handleToggle}
            disabled={maintenanceActive}
          />
          <span className="text-sm">
            {project?.automaticDeploys
              ? 'Automatic deploys are enabled'
              : 'Automatic deploys are disabled'}
          </span>
        </div>
      ) : (
        <Alert className="col-span-5 w-full text-left">
          To configure automatic deploys, you first need to connect your project
          to a GitHub repository.
        </Alert>
      )}
    </SettingsContainer>
  );
}
