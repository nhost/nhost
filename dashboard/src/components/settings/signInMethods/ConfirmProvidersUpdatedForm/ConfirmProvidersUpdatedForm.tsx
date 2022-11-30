import Form from '@/components/common/Form';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { toastStyleProps } from '@/utils/settings/settingsConstants';
import { useConfirmProvidersUpdatedMutation } from '@/utils/__generated__/graphql';
import { FormProvider, useForm, useFormContext } from 'react-hook-form';
import toast from 'react-hot-toast';

export interface ConfirmProvidersUpdatedFormProps {
  onSubmit: () => void;
  onCancel?: VoidFunction;
  submitButtonText?: string;
}

function BaseConfirmProvidersUpdatedForm({
  onSubmit,
  onCancel,
  submitButtonText = 'Confirm',
}: ConfirmProvidersUpdatedFormProps) {
  const form = useFormContext();
  const {
    formState: { isSubmitting },
  } = form;

  return (
    <div className="grid grid-flow-row gap-2 px-6 pb-6">
      <Text variant="subtitle1" component="span">
        Please make sure to update all providers before confirming because an
        environment variable will be updated in the auth service.
      </Text>

      <Form onSubmit={onSubmit} className="grid grid-flow-row gap-4">
        <div className="grid grid-flow-row gap-2">
          <Button type="submit" loading={isSubmitting}>
            {submitButtonText}
          </Button>

          <Button variant="outlined" color="secondary" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </Form>
    </div>
  );
}

export default function ConfirmProvidersUpdatedForm({
  onSubmit,
  ...props
}: ConfirmProvidersUpdatedFormProps) {
  const form = useForm();
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const [confirmProvidersUpdated] = useConfirmProvidersUpdatedMutation({
    variables: {
      id: currentApplication?.id,
    },
  });

  async function handleSubmit() {
    const confirmProvidersUpdatedPromise = confirmProvidersUpdated();

    await toast.promise(
      confirmProvidersUpdatedPromise,
      {
        loading: 'Confirming...',
        success: 'All done!',
        error: 'An error occurred while confirming.',
      },
      toastStyleProps,
    );

    onSubmit?.();
  }

  return (
    <FormProvider {...form}>
      <BaseConfirmProvidersUpdatedForm onSubmit={handleSubmit} {...props} />
    </FormProvider>
  );
}
