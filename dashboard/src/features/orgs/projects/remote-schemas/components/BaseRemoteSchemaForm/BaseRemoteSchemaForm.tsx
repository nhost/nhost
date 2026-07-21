import { type KeyboardEvent, useEffect, useRef } from 'react';
import { useFormContext, useFormState } from 'react-hook-form';
import { z } from 'zod';
import { useDialog } from '@/components/common/DialogProvider';
import { Button, ButtonWithLoading } from '@/components/ui/v3/button';
import type { DialogFormProps } from '@/types/common';
import AdditionalHeadersEditor from './AdditionalHeadersEditor';
import ForwardClientHeadersToggle from './ForwardClientHeadersToggle';
import GraphQLCustomizations from './GraphQLCustomizations';
import GraphQLServerTimeoutInput from './GraphQLServerTimeoutInput';
import GraphQLServiceURLInput from './GraphQLServiceURLInput';
import RemoteSchemaCommentInput from './RemoteSchemaCommentInput';
import RemoteSchemaNameInput from './RemoteSchemaNameInput';

const rootCustomizationSchema = z.object({
  parent_type: z.string().optional(),
  prefix: z.string().optional(),
  suffix: z.string().optional(),
});

export const baseRemoteSchemaValidationSchema = z.object({
  name: z.string().min(1, 'Name is required.'),
  comment: z.string().optional(),
  definition: z.object({
    url: z
      .string()
      .min(1, 'Service URL is required.')
      .url('Invalid service URL.'),
    forward_client_headers: z.boolean(),
    headers: z
      .array(
        z
          .object({
            name: z.string().min(1, 'Header name is required.'),
            value: z.string().optional(),
            value_from_env: z.string().optional(),
          })
          .refine(
            (header) =>
              (header.value ?? '').trim() !== '' ||
              (header.value_from_env ?? '').trim() !== '',
            {
              message:
                'Either value or value from environment variable must be provided.',
            },
          ),
      )
      .optional(),
    timeout_seconds: z.coerce
      .number({ invalid_type_error: 'Timeout must be a number.' })
      .positive('Timeout must be a positive number.'),
    customization: z
      .object({
        root_fields_namespace: z.string().optional(),
        type_prefix: z.string().optional(),
        type_suffix: z.string().optional(),
        query_root: rootCustomizationSchema.optional(),
        mutation_root: rootCustomizationSchema.optional(),
        type_names: z
          .object({
            prefix: z.string().optional(),
            suffix: z.string().optional(),
            mapping: z.record(z.string()).optional(),
          })
          .optional(),
        field_names: z
          .array(
            z.object({
              parent_type: z.string().optional(),
              prefix: z.string().optional(),
              suffix: z.string().optional(),
              mapping: z.record(z.string()).optional(),
            }),
          )
          .optional(),
      })
      .optional(),
  }),
});

export type BaseRemoteSchemaFormValues = z.infer<
  typeof baseRemoteSchemaValidationSchema
>;

export interface BaseRemoteSchemaFormProps extends DialogFormProps {
  /**
   * Function to be called when the form is submitted.
   */
  onSubmit: (values: BaseRemoteSchemaFormValues) => Promise<void>;
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
  /**
   * Whether the name input should be disabled.
   */
  nameInputDisabled?: boolean;
  /**
   * Optional slot to override the default GraphQL customizations section.
   */
  graphQLCustomizationsSlot?: React.ReactNode;
}

function FormFooter({
  onCancel,
  submitButtonText,
  location,
}: Pick<BaseRemoteSchemaFormProps, 'onCancel' | 'submitButtonText'> &
  Pick<DialogFormProps, 'location'>) {
  const { onDirtyStateChange } = useDialog();
  const { isSubmitting, dirtyFields } = useFormState();

  // react-hook-form's isDirty gets true even if an input field is focused, then
  // immediately unfocused - we can't rely on that information
  const isDirty = Object.keys(dirtyFields).length > 0;

  useEffect(() => {
    onDirtyStateChange(isDirty, location);
  }, [isDirty, location, onDirtyStateChange]);

  return (
    <div className="box grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
      <Button
        variant="ghost"
        onClick={onCancel}
        tabIndex={isDirty ? -1 : 0}
        type="button"
      >
        Cancel
      </Button>

      <ButtonWithLoading
        loading={isSubmitting}
        disabled={isSubmitting || !isDirty}
        type="submit"
        className="justify-self-end"
      >
        {submitButtonText}
      </ButtonWithLoading>
    </div>
  );
}

export default function BaseRemoteSchemaForm({
  location,
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
  nameInputDisabled = false,
  graphQLCustomizationsSlot,
}: BaseRemoteSchemaFormProps) {
  const formRef = useRef<HTMLFormElement | null>(null);
  const {
    handleSubmit,
    formState: { isSubmitting },
  } = useFormContext<BaseRemoteSchemaFormValues>();

  // Support form submission using `Ctrl + Enter` and `Cmd + Enter`.
  function handleKeyDown(event: KeyboardEvent) {
    const isModifierEnter =
      event.key === 'Enter' && (event.ctrlKey || event.metaKey);

    if (!isModifierEnter || isSubmitting) {
      return;
    }

    const submitButton = Array.from(
      formRef.current!.getElementsByTagName('button'),
    ).find((item) => item.type === 'submit');

    if (submitButton?.disabled) {
      return;
    }

    event.preventDefault();
    handleSubmit(handleExternalSubmit)(event);
  }

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit(handleExternalSubmit)}
      onKeyDown={handleKeyDown}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto pb-4">
        <section className="flex flex-col gap-3 px-6 py-6 md:grid md:grid-cols-8">
          <div className="col-span-6">
            <RemoteSchemaNameInput disabled={nameInputDisabled} />
          </div>
          <div className="col-span-6">
            <RemoteSchemaCommentInput />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t-1 px-6 py-6 md:grid md:grid-cols-8">
          <div className="col-span-6">
            <GraphQLServiceURLInput />
          </div>
          <div className="col-span-6">
            <GraphQLServerTimeoutInput />
          </div>
        </section>

        <section className="flex flex-col gap-3 border-t-1 px-6 py-6">
          <h4 className="font-semibold text-lg">
            Headers for remote GraphQL server
          </h4>
          <ForwardClientHeadersToggle />
          <AdditionalHeadersEditor />
        </section>
        <div className="box border-t-1 px-6 py-6">
          {graphQLCustomizationsSlot ?? <GraphQLCustomizations />}
        </div>
      </div>

      <FormFooter
        onCancel={onCancel}
        submitButtonText={submitButtonText}
        location={location}
      />
    </form>
  );
}
