import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { ErrorMessage } from '@/components/presentational/ErrorMessage';
import { Spinner } from '@/components/ui/v3/spinner';
import { BaseActionForm } from '@/features/orgs/projects/graphql/actions/components/BaseActionForm';
import type { BaseActionFormValues } from '@/features/orgs/projects/graphql/actions/components/BaseActionForm/BaseActionFormTypes';
import { useCreateActionMutation } from '@/features/orgs/projects/graphql/actions/hooks/useCreateActionMutation';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { buildActionDTO } from '@/features/orgs/projects/graphql/actions/utils/buildActionDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

export type CreateActionFormProps = DialogFormProps;

export default function CreateActionForm({ location }: CreateActionFormProps) {
  const { mutateAsync: createAction } = useCreateActionMutation();
  const { data: actionsData, isLoading, error, refetch } = useGetActions();
  const { closeDrawer } = useDialog();
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;

  const existingCustomTypes = useMemo(
    () => actionsData?.customTypes ?? {},
    [actionsData],
  );

  const handleSubmit = async (data: BaseActionFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const { actionArgs, customTypesArgs } = buildActionDTO({
          formValues: data,
          existingCustomTypes,
        });
        await createAction({
          args: actionArgs,
          customTypes: customTypesArgs,
          previousCustomTypes: existingCustomTypes,
        });
        closeDrawer();
        router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions/${actionArgs.name}`,
        );
      },
      {
        loadingMessage: 'Creating action...',
        successMessage: 'The action has been created successfully.',
        errorMessage:
          'An error occurred while creating the action. Please try again.',
      },
    );
  };

  if (isLoading) {
    return (
      <div className="box flex h-full items-center justify-center p-6">
        <Spinner>Loading action metadata...</Spinner>
      </div>
    );
  }

  if (error instanceof Error) {
    return (
      <div className="p-6">
        <ErrorMessage onReset={() => refetch()}>
          The action metadata could not be loaded. Please try again.
        </ErrorMessage>
      </div>
    );
  }

  return (
    <BaseActionForm
      location={location}
      onSubmit={handleSubmit}
      existingCustomTypes={existingCustomTypes}
      submitButtonText="Create"
    />
  );
}
