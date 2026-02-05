import { zodResolver } from '@hookform/resolvers/zod';
import { Plus } from 'lucide-react';
import { useCallback, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { DiscardChangesDialog } from '@/components/common/DiscardChangesDialog';
import { FormInput } from '@/components/form/FormInput';
import { FormTextarea } from '@/components/form/FormTextarea';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import { Form } from '@/components/ui/v3/form';
import { Separator } from '@/components/ui/v3/separator';
import {
  Sheet,
  SheetClose,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/v3/sheet';
import { InfoTooltip } from '@/features/orgs/projects/common/components/InfoTooltip';
import {
  DEFAULT_NUM_RETRIES,
  DEFAULT_RETRY_INTERVAL_SECONDS,
  DEFAULT_RETRY_TIMEOUT_SECONDS,
} from '@/features/orgs/projects/events/common/constants';
import { ScheduleAtTimePicker } from '@/features/orgs/projects/events/one-offs/components/ScheduleAtTimePicker';
import { useCreateOneOffMutation } from '@/features/orgs/projects/events/one-offs/hooks/useCreateOneOffMutation';
import { buildOneOffDTO } from '@/features/orgs/projects/events/one-offs/utils/buildOneOffDTO';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isJSONString } from '@/lib/utils';

const headerTypes = [
  {
    label: 'Value',
    value: 'fromValue',
  },
  {
    label: 'Env Var',
    value: 'fromEnv',
  },
] as const;

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
        headerTypes.map((header) => header.value) as [
          (typeof headerTypes)[number]['value'],
        ],
      ),
      value: z.string().min(1, 'Value is required'),
    }),
  ),
});

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

export type CreateOneOffFormValues = z.infer<typeof validationSchema>;

export type CreateOneOffFormInitialData = CreateOneOffFormValues;

interface CreateOneOffFormProps {
  disabled?: boolean;
}

export default function CreateOneOffForm({ disabled }: CreateOneOffFormProps) {
  // const router = useRouter();
  // const { orgSlug, appSubdomain } = router.query;

  const { mutateAsync: createOneOff } = useCreateOneOffMutation();

  const [showUnsavedChangesDialog, setShowUnsavedChangesDialog] =
    useState(false);
  const [isSheetOpen, setIsSheetOpen] = useState(false);

  const form = useForm<CreateOneOffFormValues>({
    resolver: zodResolver(validationSchema),
    defaultValues: defaultFormValues,
  });

  const { reset } = form;
  const { isDirty } = form.formState;

  const resetFormValues = useCallback(() => {
    reset(defaultFormValues);
  }, [reset]);

  const openForm = useCallback(() => {
    resetFormValues();
    setShowUnsavedChangesDialog(false);
    setIsSheetOpen(true);
  }, [resetFormValues]);

  const closeForm = useCallback(
    (options?: { reset?: boolean }) => {
      if (options?.reset !== false) {
        resetFormValues();
      }
      setIsSheetOpen(false);
      setShowUnsavedChangesDialog(false);
    },
    [resetFormValues],
  );

  const handleSheetOpenChange = useCallback(
    (nextOpen: boolean) => {
      if (nextOpen) {
        return;
      }

      if (isDirty) {
        setShowUnsavedChangesDialog(true);
        return;
      }

      closeForm();
    },
    [closeForm, isDirty],
  );

  const handleCreateOneOff = form.handleSubmit(async (values) => {
    await execPromiseWithErrorToast(
      async () => {
        const args = buildOneOffDTO(values);
        await createOneOff({
          args,
        });
        // router.push(
        //   `/orgs/${orgSlug}/projects/${appSubdomain}/events/cron-triggers/${data.triggerName}`,
        // );
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

  const handleDiscardChanges = () => {
    closeForm();
  };

  return (
    <>
      <Button
        variant="link"
        className="!text-sm+ mt-1 flex w-full justify-between px-[0.625rem] text-primary hover:bg-accent hover:no-underline disabled:text-disabled"
        aria-label="Add scheduled event"
        onClick={() => openForm()}
      >
        New One-off <Plus className="h-4 w-4" />
      </Button>
      <Sheet open={isSheetOpen} onOpenChange={handleSheetOpenChange}>
        <SheetContent
          showOverlay
          className="box flex w-xl flex-auto flex-col gap-0 p-0 sm:max-w-4xl md:w-4xl"
        >
          <SheetHeader className="p-6">
            <SheetTitle className="text-lg">
              Create a New One-off scheduled event
            </SheetTitle>
            <SheetDescription>
              Enter the details to create your one-off. Click Create when you're
              done
            </SheetDescription>
          </SheetHeader>
          <Separator />
          <Form {...form}>
            <form
              id="one-off-form"
              onSubmit={handleCreateOneOff}
              className="flex flex-auto flex-col gap-4 overflow-y-auto pb-4"
            >
              <div className="flex flex-auto flex-col">
                <div className="flex flex-col gap-6 p-6 text-foreground">
                  <FormInput
                    control={form.control}
                    name="comment"
                    label="Comment"
                    placeholder="A statement to help describe the scheduled event in brief"
                    className="max-w-lg"
                    autoComplete="off"
                  />
                  <ScheduleAtTimePicker />
                  <Separator />
                  <FormInput
                    control={form.control}
                    name="webhook"
                    placeholder="https://httpbin.org/post or {{MY_WEBHOOK_URL}}/handler"
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Webhook URL or template{' '}
                        <InfoTooltip>
                          Environment variables and secrets are available using
                          the {'{{VARIABLE}}'} tag.
                        </InfoTooltip>
                      </div>
                    }
                    className="max-w-lg text-foreground"
                  />
                  <FormTextarea
                    control={form.control}
                    name="payload"
                    placeholder={`{
  "name": "John Doe",
  "company": "Acme"
}`}
                    label={
                      <div className="flex flex-row items-center gap-2">
                        Payload{' '}
                        <InfoTooltip>
                          The request payload for the scheduled event, should be
                          a valid JSON
                        </InfoTooltip>
                      </div>
                    }
                    className="min-h-[250px] max-w-lg font-mono text-foreground"
                  />
                </div>
              </div>
            </form>
          </Form>
          <SheetFooter className="flex-shrink-0 border-t p-2">
            <div className="flex flex-1 flex-row items-start justify-between gap-2">
              <SheetClose asChild>
                <Button
                  variant="ghost"
                  className="text-foreground"
                  disabled={form.formState.isSubmitting}
                >
                  Cancel
                </Button>
              </SheetClose>
              <ButtonWithLoading
                type="submit"
                form="one-off-form"
                loading={form.formState.isSubmitting}
                disabled={
                  form.formState.isSubmitting || !form.formState.isDirty
                }
              >
                Create
              </ButtonWithLoading>
            </div>
          </SheetFooter>
        </SheetContent>
      </Sheet>
      <DiscardChangesDialog
        open={showUnsavedChangesDialog}
        onOpenChange={setShowUnsavedChangesDialog}
        onDiscardChanges={handleDiscardChanges}
      />
    </>
  );
}
