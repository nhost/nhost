import Form from '@/components/common/Form';
import { Alert } from '@/ui/Alert';
import Button from '@/ui/v2/Button';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import { FormProvider, useForm } from 'react-hook-form';

export interface EditPermissionsFormValues {}

export interface EditPermissionsFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: EditPermissionsFormValues) => Promise<void>;
  /**
   * Function to be called when the operation is cancelled.
   */
  onCancel?: VoidFunction;
  /**
   * Submit button text.
   *
   * @default 'Save'
   */
  submitButtonText?: string;
}

export default function EditPermissionsForm({
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
}: EditPermissionsFormProps) {
  const form = useForm<EditPermissionsFormValues>({});
  const isDirty = false;
  const isSubmitting = false;

  async function handleSubmit(values: EditPermissionsFormValues) {
    await handleExternalSubmit(values);
  }

  return (
    <FormProvider {...form}>
      <Form
        onSubmit={handleSubmit}
        className="flex flex-auto flex-col content-between overflow-hidden border-t-1 border-gray-200"
      >
        <div className="grid grid-flow-row gap-6 content-start flex-auto overflow-y-auto p-6">
          <div className="grid grid-flow-row gap-2">
            <Text component="h2" className="!font-bold !text-sm+">
              Roles & Actions overview
            </Text>

            <Text>
              Rules for each role and action can be set by clicking on the
              corresponding cell.
            </Text>
          </div>

          <div className="grid grid-flow-col gap-4 items-center justify-start">
            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              full access{' '}
              <Image
                src="/assets/full-permission.svg"
                width={20}
                height={20}
                layout="fixed"
                alt="Three filled horizontal lines"
              />
            </Text>

            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              partial access{' '}
              <Image
                src="/assets/partial-permission.svg"
                width={20}
                height={20}
                layout="fixed"
                alt="Three horizontal lines, the middle is filled"
              />
            </Text>

            <Text
              variant="subtitle2"
              className="!text-greyscaleDark grid items-center grid-flow-col gap-1"
            >
              no access{' '}
              <Image
                src="/assets/no-permission.svg"
                width={20}
                height={20}
                layout="fixed"
                alt="Three horizontal lines"
              />
            </Text>
          </div>

          <Alert>
            Please go to the{' '}
            <Link href="/settings" underline="none">
              Settings page
            </Link>{' '}
            to add and delete roles.
          </Alert>
        </div>

        <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 border-gray-200 p-2">
          <Button
            variant="borderless"
            color="secondary"
            onClick={onCancel}
            tabIndex={isDirty ? -1 : 0}
          >
            Cancel
          </Button>

          <Button
            loading={isSubmitting}
            disabled={isSubmitting}
            type="submit"
            className="justify-self-end"
          >
            {submitButtonText}
          </Button>
        </div>
      </Form>
    </FormProvider>
  );
}
