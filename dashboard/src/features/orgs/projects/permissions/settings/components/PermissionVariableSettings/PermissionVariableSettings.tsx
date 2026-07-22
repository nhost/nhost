import {
  EllipsisVertical as DotsVerticalIcon,
  LockIcon,
  PlusIcon,
} from 'lucide-react';
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
import { useLocalMimirClient } from '@/features/orgs/projects/hooks/useLocalMimirClient';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { CreatePermissionVariableForm } from '@/features/orgs/projects/permissions/settings/components/CreatePermissionVariableForm';
import { EditPermissionVariableForm } from '@/features/orgs/projects/permissions/settings/components/EditPermissionVariableForm';
import { getAllPermissionVariables } from '@/features/orgs/projects/permissions/settings/utils/getAllPermissionVariables';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import {
  useGetRolesPermissionsQuery,
  useUpdateConfigMutation,
} from '@/generated/graphql';
import type { PermissionVariable } from '@/types/application';

export default function PermissionVariableSettings() {
  const { project } = useProject();
  const isPlatform = useIsPlatform();
  const localMimirClient = useLocalMimirClient();
  const { openDialog, openAlertDialog } = useDialog();

  const { data, error, refetch } = useGetRolesPermissionsQuery({
    variables: { appId: project?.id },
    fetchPolicy: 'cache-and-network',
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  const { customClaims: permissionVariables } =
    data?.config?.auth?.session?.accessToken || {};

  const [updateConfig] = useUpdateConfigMutation({
    ...(!isPlatform ? { client: localMimirClient } : {}),
  });

  if (error) {
    throw error;
  }

  function showApplyChangesDialog() {
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
  }

  async function handleDeleteVariable({ id }: PermissionVariable) {
    const updateConfigPromise = updateConfig({
      variables: {
        appId: project?.id,
        config: {
          auth: {
            session: {
              accessToken: {
                customClaims: permissionVariables
                  ?.filter((permissionVariable) => permissionVariable.id !== id)
                  .map((permissionVariable) => ({
                    key: permissionVariable.key,
                    value: permissionVariable.value,
                  })),
              },
            },
          },
        },
      },
    });

    await execPromiseWithErrorToast(
      async () => {
        await updateConfigPromise;
        await refetch();
        showApplyChangesDialog();
      },
      {
        loadingMessage: 'Deleting permission variable...',
        successMessage: 'Permission variable has been deleted successfully.',
        errorMessage:
          'An error occurred while trying to delete permission variable.',
      },
    );
  }

  function handleOpenCreator() {
    openDialog({
      title: 'Create Permission Variable',
      component: <CreatePermissionVariableForm onSubmit={refetch} />,
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleOpenEditor(originalVariable: PermissionVariable) {
    openDialog({
      title: 'Edit Permission Variable',
      component: (
        <EditPermissionVariableForm
          originalVariable={originalVariable}
          onSubmit={refetch}
        />
      ),
      props: {
        titleProps: { className: '!pb-0' },
        PaperProps: { className: 'max-w-sm' },
      },
    });
  }

  function handleConfirmDelete(originalVariable: PermissionVariable) {
    openAlertDialog({
      title: 'Delete Permission Variable',
      payload: (
        <p>
          Are you sure you want to delete the &quot;
          <strong>X-Hasura-{originalVariable.key}</strong>&quot; permission
          variable? This cannot be undone.
        </p>
      ),
      props: {
        onPrimaryAction: () => handleDeleteVariable(originalVariable),
        primaryButtonColor: 'error',
        primaryButtonText: 'Delete',
      },
    });
  }

  const availablePermissionVariables =
    getAllPermissionVariables(permissionVariables);

  return (
    <SettingsCard className="gap-0">
      <SettingsCardHeader
        title="Permission Variables"
        description="Permission variables are used to define permission rules in the GraphQL API."
      />

      <SettingsCardContent className="my-2 px-0">
        <div className="grid grid-cols-2 border-b-1 px-4 py-3">
          <p className="font-medium">Field name</p>
          <p className="font-medium">Path</p>
        </div>

        <div className="grid grid-flow-row gap-2">
          <div>
            {availablePermissionVariables.map((permissionVariable, index) => (
              <Fragment key={permissionVariable.id}>
                <div className="relative grid grid-cols-2 px-4 pr-12">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute top-1/2 right-4 -translate-y-1/2"
                        disabled={permissionVariable.isSystemVariable}
                      >
                        <DotsVerticalIcon className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>

                    <DropdownMenuContent align="end" className="w-32 p-0">
                      <DropdownMenuItem
                        onClick={() => handleOpenEditor(permissionVariable)}
                        className="flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                      >
                        <span>Edit</span>
                      </DropdownMenuItem>

                      <DropdownMenuItem
                        onClick={() => handleConfirmDelete(permissionVariable)}
                        className="!text-destructive flex h-9 cursor-pointer items-center justify-start gap-2 rounded-none border border-b-1 p-2 font-medium text-sm+ leading-4 hover:bg-data-cell-bg"
                      >
                        <span>Delete</span>
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <p>
                    X-Hasura-{permissionVariable.key}{' '}
                    {permissionVariable.isSystemVariable && (
                      <LockIcon className="inline-block h-4 w-4" />
                    )}
                  </p>

                  <p className="font-medium">user.{permissionVariable.value}</p>
                </div>

                <div
                  className={twMerge(
                    'border-t',
                    index === availablePermissionVariables.length - 1
                      ? '!mt-4'
                      : '!my-4',
                  )}
                />
              </Fragment>
            ))}
          </div>

          <Button
            type="button"
            variant="ghost"
            className="mx-4 justify-self-start text-primary-main hover:bg-primary-highlight hover:text-primary-main"
            onClick={handleOpenCreator}
          >
            <PlusIcon className="mr-2 h-4 w-4" />
            Create Permission Variable
          </Button>
        </div>
      </SettingsCardContent>

      <SettingsCardFooter>
        <SettingsDocsLink
          href="https://docs.nhost.io/products/graphql/permissions#permission-variables"
          title="Permission Variables"
        />
      </SettingsCardFooter>
    </SettingsCard>
  );
}
