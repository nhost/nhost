import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { FormProvider, useForm, useFormState } from 'react-hook-form';
import { useDialog } from '@/components/common/DialogProvider';
import { FormInput } from '@/components/form/FormInput';
import { FormSwitch } from '@/components/form/FormSwitch';
import { Button } from '@/components/ui/v3/button';
import type { BucketFormValues } from '@/features/orgs/projects/storage/components/BaseBucketForm/bucketFormSchema';
import {
  bucketFormSchema,
  defaultBucketFormValues,
} from '@/features/orgs/projects/storage/components/BaseBucketForm/bucketFormSchema';
import type { DialogFormProps } from '@/types/common';

export interface BaseBucketFormProps extends DialogFormProps {
  onSubmit: (values: BucketFormValues) => Promise<void>;
  onCancel?: VoidFunction;
  initialValues?: BucketFormValues;
  submitButtonText?: string;
}

function FormFooter({
  onCancel,
  submitButtonText,
  location,
}: Pick<BaseBucketFormProps, 'onCancel' | 'submitButtonText'> &
  Pick<DialogFormProps, 'location'>) {
  const { onDirtyStateChange } = useDialog();
  const { isSubmitting, dirtyFields } = useFormState();

  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <div className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t p-2">
      <Button
        variant="ghost"
        type="button"
        onClick={onCancel}
        tabIndex={isDirty ? -1 : 0}
      >
        Cancel
      </Button>

      <Button type="submit" disabled={isSubmitting}>
        {submitButtonText}
      </Button>
    </div>
  );
}

export default function BaseBucketForm({
  location,
  onSubmit,
  onCancel,
  initialValues,
  submitButtonText = 'Save',
}: BaseBucketFormProps) {
  const form = useForm<BucketFormValues>({
    defaultValues: initialValues ?? defaultBucketFormValues,
    resolver: zodResolver(bucketFormSchema),
    reValidateMode: 'onSubmit',
  });

  return (
    <FormProvider {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-auto flex-col content-between overflow-hidden border-t"
      >
        <div className="flex-auto overflow-y-auto px-6 py-3">
          <FormInput
            control={form.control}
            name="name"
            label="Name"
            autoComplete="off"
            inline
          />

          <FormInput
            control={form.control}
            name="minUploadFileSize"
            label="Min Upload File Size (bytes)"
            type="number"
            inline
          />

          <FormInput
            control={form.control}
            name="maxUploadFileSize"
            label="Max Upload File Size (bytes)"
            type="number"
            inline
          />

          <FormInput
            control={form.control}
            name="downloadExpiration"
            label="Download Expiration (seconds)"
            type="number"
            inline
          />

          <FormInput
            control={form.control}
            name="cacheControl"
            label="Cache Control"
            autoComplete="off"
            inline
          />

          <FormSwitch
            control={form.control}
            name="presignedUrlsEnabled"
            label="Presigned URLs Enabled"
            inline
          />
        </div>

        <FormFooter
          onCancel={onCancel}
          submitButtonText={submitButtonText}
          location={location}
        />
      </form>
    </FormProvider>
  );
}
