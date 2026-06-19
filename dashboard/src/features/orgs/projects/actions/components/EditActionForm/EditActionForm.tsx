import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { useDialog } from '@/components/common/DialogProvider';
import { BaseActionForm } from '@/features/orgs/projects/actions/components/BaseActionForm';
import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { useUpdateActionMutation } from '@/features/orgs/projects/actions/hooks/useUpdateActionMutation';
import { buildActionDTO } from '@/features/orgs/projects/actions/utils/buildActionDTO';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { parseActionFormInitialData } from '@/features/orgs/projects/actions/utils/parseActionFormInitialData';
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
  const { data: actionsData } = useGetActions();
  const { mutateAsync: updateAction } = useUpdateActionMutation();

  const existingCustomTypes = useMemo(
    () => actionsData?.customTypes ?? {},
    [actionsData],
  );

  const initialData = useMemo(
    () => parseActionFormInitialData(action, existingCustomTypes),
    [action, existingCustomTypes],
  );

  const originalActionTypenames = useMemo(
    () =>
      getActionTypes(
        action.definition,
        parseCustomTypes(existingCustomTypes),
      ).map((type) => type.name),
    [action, existingCustomTypes],
  );

  const handleSubmit = async (data: BaseActionFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const { actionArgs, customTypesArgs } = buildActionDTO({
          formValues: data,
          existingCustomTypes,
          originalAction: action,
        });

        if (actionArgs.name !== action.name) {
          throw new Error(
            'Renaming an action is not supported. Create a new action instead.',
          );
        }

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

  return (
    <BaseActionForm
      location={location}
      onSubmit={handleSubmit}
      initialData={initialData}
      existingCustomTypes={existingCustomTypes}
      originalActionTypenames={originalActionTypenames}
      submitButtonText="Save"
    />
  );
}
