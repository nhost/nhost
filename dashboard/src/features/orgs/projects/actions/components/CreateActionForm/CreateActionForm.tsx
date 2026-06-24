import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { Spinner } from '@/components/ui/v3/spinner';
import { BaseActionForm } from '@/features/orgs/projects/actions/components/BaseActionForm';
import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { useCreateActionMutation } from '@/features/orgs/projects/actions/hooks/useCreateActionMutation';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { buildActionDTO } from '@/features/orgs/projects/actions/utils/buildActionDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';

export type CreateActionFormProps = DialogFormProps;

export default function CreateActionForm({ location }: CreateActionFormProps) {
  const { mutateAsync: createAction } = useCreateActionMutation();
  const { data: actionsData, isLoading } = useGetActions();
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
        <Spinner>Loading action...</Spinner>
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
