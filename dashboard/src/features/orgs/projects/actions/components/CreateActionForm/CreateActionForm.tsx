import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { useMemo } from 'react';
import { Button } from '@/components/ui/v3/button';
import {
  BaseActionForm,
  type BaseActionFormTriggerProps,
} from '@/features/orgs/projects/actions/components/BaseActionForm';
import type { BaseActionFormValues } from '@/features/orgs/projects/actions/components/BaseActionForm/BaseActionFormTypes';
import { useCreateActionMutation } from '@/features/orgs/projects/actions/hooks/useCreateActionMutation';
import { useGetActions } from '@/features/orgs/projects/actions/hooks/useGetActions';
import { buildActionDTO } from '@/features/orgs/projects/actions/utils/buildActionDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const renderCreateActionButton = ({ open }: BaseActionFormTriggerProps) => (
  <Button
    variant="link"
    className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
    onClick={() => open()}
  >
    New Action <Plus className="h-4 w-4" />
  </Button>
);

export default function CreateActionForm() {
  const { mutateAsync: createAction } = useCreateActionMutation();
  const { data: actionsData } = useGetActions();
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
        });
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

  return (
    <BaseActionForm
      trigger={renderCreateActionButton}
      onSubmit={handleSubmit}
      existingCustomTypes={existingCustomTypes}
      titleText="Create a New Action"
      descriptionText="Enter the details to create your action. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}
