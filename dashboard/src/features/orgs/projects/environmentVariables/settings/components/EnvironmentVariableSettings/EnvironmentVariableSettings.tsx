import { PencilIcon, PlusIcon, Trash2Icon } from 'lucide-react';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { TableCell, TableRow } from '@/components/ui/v3/table';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/CreateEnvironmentVariableForm';
import { EditEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditEnvironmentVariableForm';
import { VariableGroup } from '@/features/orgs/projects/environmentVariables/settings/components/VariableGroup';
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetEnvironmentVariablesQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import type { EnvironmentVariable } from '@/types/application';

export interface EnvironmentVariableSettingsFormValues {
  /**
   * Environment variables.
   */
  environmentVariables: EnvironmentVariable[];
}

export default function EnvironmentVariableSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, error, refetch } = useGetEnvironmentVariablesQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const availableEnvironmentVariables = [
    ...(data?.config?.global?.environment || []),
  ].sort((a, b) => {
    if (a.name < b.name) {
      return -1;
    }

    if (a.name > b.name) {
      return 1;
    }

    return 0;
  });

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  async function handleDeleteVariable({ id }: EnvironmentVariable) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          global: {
            environment: availableEnvironmentVariables
              .filter((variable) => variable.id !== id)
              .map((variable) => ({
                name: variable.name,
                value: variable.value,
              })),
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        await refetch();

        if (!isPlatform) {
          openDialog({
            title: 'Apply your changes',
            component: <ApplyLocalSettingsDialog />,
            props: {
              PaperProps: {
                className: 'max-w-2xl',
              },
            },
          });
        }
      },
      {
        loadingMessage: 'Deleting environment variable...',
        successMessage: 'Environment variable has been deleted successfully.',
        errorMessage:
          'An error occurred while deleting the environment variable.',
      },
    );
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create environment variable',
      component: <CreateEnvironmentVariableForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-xl' },
      },
    });
  }

  function handleOpenEditor(originalVariable: EnvironmentVariable) {
    openDialog({
      title: 'Edit environment variable',
      component: (
        <EditEnvironmentVariableForm
          originalEnvironmentVariable={originalVariable}
          onSubmit={refetch}
        />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-xl' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: EnvironmentVariable) {
    openAlertDialog({
      title: 'Delete environment variable',
      payload: (
        <p>
          Are you sure you want to delete the &quot;
          <strong>{originalVariable.name}</strong>&quot; environment variable?
          This cannot be undone.
        </p>
      ),
      props: {
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
        onPrimaryAction: () => handleDeleteVariable(originalVariable),
      },
    });
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        title="Project environment variables"
        description="Key-value pairs available to all your services, kept outside your source code. Use them for API keys and values that change between environments."
        docsLink={{
          href: 'https://docs.nhost.io/platform/cloud/environment-variables',
          topic: 'Environment Variables',
        }}
        actions={
          <Button type="button" variant="outline" onClick={handleOpenCreator}>
            <PlusIcon className="mr-2" />
            Create environment variable
          </Button>
        }
      />

      {availableEnvironmentVariables.length > 0 && (
        <SettingsCardContent className="mt-2">
          <VariableGroup>
            {availableEnvironmentVariables.map((environmentVariable) => (
              <TableRow key={environmentVariable.id} className="group">
                <TableCell className="break-all font-mono">
                  {environmentVariable.name}
                </TableCell>
                <TableCell className="w-24">
                  <div className="flex justify-end gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="subtle"
                          aria-label={`Edit ${environmentVariable.name}`}
                          onClick={() => handleOpenEditor(environmentVariable)}
                        >
                          <PencilIcon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Button
                          type="button"
                          variant="subtle"
                          className="hover:text-destructive dark:hover:text-destructive"
                          aria-label={`Delete ${environmentVariable.name}`}
                          onClick={() =>
                            handleConfirmDelete(environmentVariable)
                          }
                        >
                          <Trash2Icon />
                        </Button>
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </VariableGroup>
        </SettingsCardContent>
      )}
    </SettingsCard>
  );
}
