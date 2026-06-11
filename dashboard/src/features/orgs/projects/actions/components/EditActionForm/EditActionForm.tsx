import { useRouter } from 'next/router';
import { type ReactNode, useEffect, useMemo, useState } from 'react';
import {
  BaseActionForm,
  type BaseActionFormTriggerProps,
} from '@/features/orgs/projects/actions/components/BaseActionForm';
import type {
  BaseActionFormInitialData,
  BaseActionFormValues,
} from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { useUpdateActionMutation } from '@/features/orgs/projects/actions/hooks/useUpdateActionMutation';
import { buildActionDTO } from '@/features/orgs/projects/actions/utils/buildActionDTO';
import {
  getActionTypes,
  parseCustomTypes,
} from '@/features/orgs/projects/actions/utils/customTypesUtils';
import { parseActionFormInitialData } from '@/features/orgs/projects/actions/utils/parseActionFormInitialData';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import type { ActionItem } from '@/utils/hasura-api/generated/schemas';

export interface EditActionFormProps {
  action: ActionItem;
  trigger: (props: BaseActionFormTriggerProps) => ReactNode;
}

export default function EditActionForm({
  action,
  trigger,
}: EditActionFormProps) {
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;
  const { data: actionsData } = useGetActions();
  const { mutateAsync: updateAction } = useUpdateActionMutation();

  const existingCustomTypes = useMemo(
    () => actionsData?.customTypes ?? {},
    [actionsData],
  );

  const [initialData, setInitialData] = useState<BaseActionFormInitialData>(
    () => parseActionFormInitialData(action, existingCustomTypes),
  );

  useEffect(() => {
    setInitialData(parseActionFormInitialData(action, existingCustomTypes));
  }, [action, existingCustomTypes]);

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
        });
        setInitialData(data);
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
      trigger={trigger}
      onSubmit={handleSubmit}
      initialData={initialData}
      existingCustomTypes={existingCustomTypes}
      originalActionTypenames={originalActionTypenames}
      titleText="Edit Action"
      descriptionText="Enter the details to edit your action. Click Save when you're done."
      submitButtonText="Save"
    />
  );
}
