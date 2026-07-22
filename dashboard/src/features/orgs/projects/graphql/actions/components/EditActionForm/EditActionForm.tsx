import { useRouter } from 'next/router';
import { useDialog } from '@/components/common/DialogProvider';
import { ErrorMessage } from '@/components/presentational/ErrorMessage';
import { Spinner } from '@/components/ui/v3/spinner';
import { BaseActionForm } from '@/features/orgs/projects/graphql/actions/components/BaseActionForm';
import type { BaseActionFormValues } from '@/features/orgs/projects/graphql/actions/components/BaseActionForm/BaseActionFormTypes';
import { useGetActions } from '@/features/orgs/projects/graphql/actions/hooks/useGetActions';
import { useUpdateActionMutation } from '@/features/orgs/projects/graphql/actions/hooks/useUpdateActionMutation';
import { buildActionDTO } from '@/features/orgs/projects/graphql/actions/utils/buildActionDTO';
import { parseActionFormInitialData } from '@/features/orgs/projects/graphql/actions/utils/parseActionFormInitialData';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { DialogFormProps } from '@/types/common';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';

export interface EditActionFormProps extends DialogFormProps {
  action: ActionItem;
}

export default function EditActionForm({
  action,
  location,
}: EditActionFormProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const { closeDrawer } = useDialog();
  const { data: actionsData, isLoading, error, refetch } = useGetActions();
  const { mutateAsync: updateAction } = useUpdateActionMutation();

  const existingCustomTypes = actionsData?.customTypes ?? {};

  const { initialData, originalTypeNames } = parseActionFormInitialData(
    action,
    existingCustomTypes,
  );

  const handleSubmit = async (data: BaseActionFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const { actionArgs, customTypesArgs } = buildActionDTO({
          formValues: data,
          existingCustomTypes,
          originalAction: action,
        });

        await updateAction({
          args: actionArgs,
          customTypes: customTypesArgs,
          previousCustomTypes: existingCustomTypes,
          originalAction: action,
        });
        closeDrawer();
        router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/graphql/actions/${action.name}`,
        );
      },
      {
        loadingMessage: 'Editing action...',
        successMessage: 'The action has been edited successfully.',
        errorMessage:
          'An error occurred while editing the action. Please try again.',
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
      initialData={initialData}
      existingCustomTypes={existingCustomTypes}
      originalActionTypenames={originalTypeNames}
      lockedActionName={action.name}
      submitButtonText="Save"
    />
  );
}
