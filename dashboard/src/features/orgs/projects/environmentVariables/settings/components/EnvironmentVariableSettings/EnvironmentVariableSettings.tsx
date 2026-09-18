import { Pencil, PlusIcon, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { ApplyLocalSettingsDialog } from '@/components/common/ApplyLocalSettingsDialog';
import { useDialog } from '@/components/common/DialogProvider';
import { AppDialog } from '@/components/layout/AppDialog';
import {
  SettingsCard,
  SettingsCardContent,
  SettingsCardHeader,
  SettingsDocsLink,
  SettingsTable,
  SettingsTableBody,
  SettingsTableHeader,
  SettingsTableRow,
} from '@/components/layout/SettingsCard';

import { Button } from '@/components/ui/v3/button';
import { IconButton } from '@/components/ui/v3/icon-button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';
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
  // Still used for the "Apply your changes" follow-up dialog on self-hosted
  // (non-platform) projects, which stays on the old dialog system for now.
  const { openDialog } = useDialog();

  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [isCreateFormDirty, setIsCreateFormDirty] = useState(false);

  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [isEditFormDirty, setIsEditFormDirty] = useState(false);
  const [editingVariable, setEditingVariable] =
    useState<EnvironmentVariable | null>(null);

  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deletingVariable, setDeletingVariable] =
    useState<EnvironmentVariable | null>(null);

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
    setCreateDialogOpen(true);
  }

  function handleOpenEditor(originalVariable: EnvironmentVariable) {
    setEditingVariable(originalVariable);
    setEditDialogOpen(true);
  }

  function handleConfirmDelete(originalVariable: EnvironmentVariable) {
    setDeletingVariable(originalVariable);
    setDeleteDialogOpen(true);
  }

  return (
    <SettingsCard className="gap-0">
      <SettingsCardHeader
        // Top-aligned instead of the shared default's vertical centering,
        // since this header carries a two-line description below the
        // title and the button should sit level with the title, not
        // centered against the whole block. contentClassName caps the
        // left column the same way Delete Project's does, guaranteeing
        // real horizontal space before the button regardless of how the
        // description wraps.
        className="sm:items-start"
        contentClassName="sm:max-w-lg"
        title={
          <span className="flex items-center gap-2">
            <h3 className="font-semibold text-lg">
              Project Environment Variables
            </h3>
            <SettingsDocsLink
              href="https://docs.nhost.io/platform/cloud/environment-variables"
              title="Environment Variables"
            />
          </span>
        }
        description="Environment Variables are key-value pairs configured outside your source code. They are used to store environment-specific values such as API keys."
        control={
          <Button
            type="button"
            variant="outline-emboss"
            onClick={handleOpenCreator}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Environment Variable
          </Button>
        }
      />

      {availableEnvironmentVariables.length > 0 && (
        <SettingsCardContent className="mt-6 px-0">
          <SettingsTable>
            <SettingsTableHeader>
              <p className="font-bold">Variable Name</p>
            </SettingsTableHeader>

            <SettingsTableBody>
              {availableEnvironmentVariables.map((environmentVariable) => (
                <SettingsTableRow
                  key={environmentVariable.id}
                  className="flex items-center justify-between gap-2"
                >
                  <p className="min-w-0 truncate">
                    {environmentVariable.name}
                  </p>

                  <div className="flex shrink-0 items-center gap-1">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <IconButton
                          icon={Pencil}
                          aria-label="Edit"
                          onClick={() =>
                            handleOpenEditor(environmentVariable)
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent>Edit</TooltipContent>
                    </Tooltip>

                    <Tooltip>
                      <TooltipTrigger asChild>
                        <IconButton
                          icon={Trash2}
                          aria-label="Delete"
                          onClick={() =>
                            handleConfirmDelete(environmentVariable)
                          }
                        />
                      </TooltipTrigger>
                      <TooltipContent>Delete</TooltipContent>
                    </Tooltip>
                  </div>
                </SettingsTableRow>
              ))}
            </SettingsTableBody>
          </SettingsTable>
        </SettingsCardContent>
      )}

      <AppDialog
        type="form"
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Create Environment Variable"
        isDirty={isCreateFormDirty}
      >
        <CreateEnvironmentVariableForm
          onCancel={() => setCreateDialogOpen(false)}
          onDirtyStateChange={setIsCreateFormDirty}
          onSubmit={async () => {
            await refetch();
            setCreateDialogOpen(false);
          }}
        />
      </AppDialog>

      <AppDialog
        type="form"
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        title="Edit Environment Variable"
        isDirty={isEditFormDirty}
      >
        {editingVariable && (
          <EditEnvironmentVariableForm
            originalEnvironmentVariable={editingVariable}
            onCancel={() => setEditDialogOpen(false)}
            onDirtyStateChange={setIsEditFormDirty}
            onSubmit={async () => {
              await refetch();
              setEditDialogOpen(false);
            }}
          />
        )}
      </AppDialog>

      <AppDialog
        type="confirm"
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        title="Delete Environment Variable"
        description={
          deletingVariable && (
            <>
              Are you sure you want to delete the &quot;
              <strong>{deletingVariable.name}</strong>&quot; environment
              variable? This cannot be undone.
            </>
          )
        }
        destructive
        primaryAction={{
          label: 'Delete',
          onClick: () => {
            if (deletingVariable) {
              handleDeleteVariable(deletingVariable);
            }
          },
        }}
      />
    </SettingsCard>
  );
}
