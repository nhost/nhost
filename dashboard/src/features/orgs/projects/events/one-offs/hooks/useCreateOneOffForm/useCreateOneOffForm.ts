import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { HEADER_TYPES } from '@/features/orgs/projects/events/common/components/HeadersFormSection';
import {
  DEFAULT_NUM_RETRIES,
  DEFAULT_RETRY_INTERVAL_SECONDS,
  DEFAULT_RETRY_TIMEOUT_SECONDS,
} from '@/features/orgs/projects/events/common/constants';
import { useCreateOneOffMutation } from '@/features/orgs/projects/events/one-offs/hooks/useCreateOneOffMutation';
import { buildOneOffDTO } from '@/features/orgs/projects/events/one-offs/utils/buildOneOffDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isJSONString } from '@/lib/utils';

const validationSchema = z.object({
  comment: z.string().optional(),
  webhook: z.string().min(1, { message: 'Webhook URL required' }),
  scheduleAt: z.string().min(1, { message: 'Schedule required' }),
  payload: z
    .string()
    .min(1, { message: 'Payload required' })
    .refine((arg: string) => isJSONString(arg), {
      message: 'Payload must be valid json',
    }),
  retryConf: z.object({
    numRetries: z.coerce.number().min(0),
    intervalSec: z.coerce.number().min(0),
    timeoutSec: z.coerce.number().min(0),
  }),
  headers: z.array(
    z.object({
      name: z.string().min(1, 'Name is required'),
      type: z.enum(
        HEADER_TYPES.map((header) => header.value) as [
          (typeof HEADER_TYPES)[number]['value'],
        ],
      ),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
});

export type CreateOneOffFormValues = z.infer<typeof validationSchema>;

function getDefaultScheduleAt() {
  const date = new Date();
  date.setHours(date.getHours() + 1);
  return date.toISOString();
}

const defaultFormValues: CreateOneOffFormValues = {
  comment: '',
  webhook: '',
  scheduleAt: getDefaultScheduleAt(),
  retryConf: {
    numRetries: DEFAULT_NUM_RETRIES,
    intervalSec: DEFAULT_RETRY_INTERVAL_SECONDS,
    timeoutSec: DEFAULT_RETRY_TIMEOUT_SECONDS,
  },
  payload: '',
  headers: [],
};

export default function useCreateOneOffForm() {
  const { mutateAsync: createOneOff } = useCreateOneOffMutation();

  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<CreateOneOffFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: defaultFormValues,
  });

  function resetFormValues() {
    form.reset(defaultFormValues);
  }

  function openForm() {
    resetFormValues();
    setShowUnsavedChangesDialog(false);
    setIsSheetOpen(true);
  }

  function closeForm(options?: { reset?: boolean }) {
    if (options?.reset !== false) {
      resetFormValues();
    }
    setIsSheetOpen(false);
    setShowUnsavedChangesDialog(false);
  }

  function handleSheetOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      return;
    }

    if (form.formState.isDirty) {
      setShowUnsavedChangesDialog(true);
      return;
    }

    closeForm();
  }

  const handleSubmit = form.handleSubmit(async (values) => {
    await execPromiseWithErrorToast(
      async () => {
        const args = buildOneOffDTO(values);
        await createOneOff({ args });
      },
      {
        loadingMessage: 'Creating one off scheduled event...',
        successMessage: 'The scheduled event has been created successfully.',
        errorMessage:
          'An error occurred while creating the scheduled event. Please try again.',
      },
    );
    closeForm();
  });

  return {
    form,
    isSheetOpen,
    showUnsavedChangesDialog,
    setShowUnsavedChangesDialog,
    openForm,
    closeForm,
    handleSheetOpenChange,
    handleSubmit,
  };
}
