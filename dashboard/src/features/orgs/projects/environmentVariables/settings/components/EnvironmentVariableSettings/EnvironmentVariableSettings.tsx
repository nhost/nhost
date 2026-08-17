import { EllipsisVertical as DotsVerticalIcon, PlusIcon } from 'lucide-react';
import { Fragment } from 'react';
import { twMerge } from 'tailwind-merge';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardFooter,
  SettingsCardHeader,
  SettingsDocsLink,
} from '@/components/layout/SettingsCard';

import { Button } from '@/components/ui/v3/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/v3/dropdown-menu';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { CreateEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/CreateEnvironmentVariableForm';
import { EditEnvironmentVariableForm } from '@/features/orgs/projects/environmentVariables/settings/components/EditEnvironmentVariableForm';
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
      title: 'Create Environment Variable',
      component: <CreateEnvironmentVariableForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: EnvironmentVariable) {
    openDialog({
      title: 'Edit Environment Variable',
      component: (
        <EditEnvironmentVariableForm
          originalEnvironmentVariable={originalVariable}
          onSubmit={refetch}
        />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'gap-2 max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: EnvironmentVariable) {
    openAlertDialog({
      title: 'Delete Environment Variable',
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
    <SettingsCard className="gap-0">
      <SettingsCardHeader
        title="Project Environment Variables"
        description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
      />

      <SettingsCardContent
        className={twMerge(
          'my-2 px-0',
          availableEnvironmentVariables.length === 0 && 'gap-2',
        )}
      >
        <div className="grid grid-cols-2 gap-2 border-b-1 px-4 py-3 lg:grid-cols-3">
          <p className="font-medium">Variable Name</p>
        </div>

        <div className="grid grid-flow-row gap-2">
          {availableEnvironmentVariables.length > 0 && (
            <div>
              {availableEnvironmentVariables.map(
                (environmentVariable, index) => (
                  <Fragment key={environmentVariable.id}>
                    <div className="relative grid grid-cols-2 gap-2 px-4 pr-12 lg:grid-cols-3">
                      <p className="truncate">{environmentVariable.name}</p>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            className="absolute top-1/2 right-4 -translate-y-1/2"
                          >
                            <DotsVerticalIcon className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>

                        <DropdownMenuContent align="end" className="w-32 p-0">
                          <DropdownMenuItem
                            onClick={() =>
                              handleOpenEditor(environmentVariable)
                            }
                            className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                          >
                            <span>Edit</span>
                          </DropdownMenuItem>

                          <DropdownMenuItem
                            onClick={() =>
                              handleConfirmDelete(environmentVariable)
                            }
                            className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                          >
                            <span>Delete</span>
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    <div
                      className={twMerge(
                        'border-t',
                        index === availableEnvironmentVariables.length - 1
                          ? '!mt-4'
                          : '!my-4',
                      )}
                    />
                  </Fragment>
                ),
              )}
            </div>
          )}

          <Button
            type="button"
            variant="ghost"
            className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
            onClick={handleOpenCreator}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Environment Variable
          </Button>
        </div>
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/platform/cloud/environment-variables"
          title="Environment Variables"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
