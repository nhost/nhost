import { Button } from '@/components/ui/v3/button';
import {
  BaseCronTriggerForm,
  type BaseCronTriggerFormTriggerProps,
} from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm';
import type { BaseCronTriggerFormValues } from '@/features/orgs/projects/events/cron-triggers/components/BaseCronTriggerForm/BaseCronTriggerFormTypes';
import { useCreateCronTriggerMutation } from '@/features/orgs/projects/events/cron-triggers/hooks/useCreateCronTriggerMutation';
import { buildCronTriggerDTO } from '@/features/orgs/projects/events/cron-triggers/utils/buildCronTriggerDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { Plus } from 'lucide-react';
import { useRouter } from 'next/router';

const renderCreateCronTriggerButton = ({
  open,
}: BaseCronTriggerFormTriggerProps) => (
  <Button
    variant="ghost"
    size="icon"
    aria-label="Add cron trigger"
    onClick={() => open()}
  >
    <Plus className="h-5 w-5 text-primary dark:text-foreground" />
  </Button>
);

export default function CreateCronTriggerForm() {
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
          `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-trigger/${data.triggerName}`,
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
      trigger={renderCreateCronTriggerButton}
      onSubmit={handleSubmit}
      titleText="Create a New Cron Trigger"
      descriptionText="Enter the details to create your cron trigger. Click Create when you're done."
      submitButtonText="Create"
    />
  );
}
