import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';
import { Button } from '@/components/ui/v3/button';
import {
  BaseCronTriggerForm,
  type BaseCronTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useCreateCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useCreateCronTriggerMutation';
import { buildCronTriggerDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildCronTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';

const renderCreateCronTriggerButton = ({
  open,
}: BaseCronTriggerFormTriggerProps) => (
  <Button
    variant="link"
    className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
    onClick={() => open()}
  >
    New Cron Trigger <Plus className="h-4 w-4" />
  </Button>
);

interface CreateCronTriggerFormProps {
  disabled: boolean;
}

export default function CreateCronTriggerForm({
  disabled,
}: CreateCronTriggerFormProps) {
  const { mutateAsync: createCronTrigger } = useCreateCronTriggerMutation();
  const router = useRouter();
  const { orgSlug, appSubdomain } = router.query;

  const handleSubmit = async (data: BaseCronTriggerFormValues) => {
    await execPromiseWithErrorToast(
      async () => {
        const cronTriggerDTO = buildCronTriggerDTO({ formValues: data });
        await createCronTrigger({
          args: cronTriggerDTO,
        });
        router.push(
          `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-triggers/${data.triggerName}`,
        );
      },
      {
        loadingMessage: 'Creating cron trigger...',
        successMessage: 'The cron trigger has been created successfully.',
        errorMessage:
          'An error occurred while creating the cron trigger. Please try again.',
      },
    );
  };

  return (
    <BaseCronTriggerForm
      trigger={disabled ? undefined : renderCreateCronTriggerButton}
      onSubmit={handleSubmit}
      titleText="Create a New Cron Trigger"
      descriptionText="Enter the details to create your cron trigger. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}
