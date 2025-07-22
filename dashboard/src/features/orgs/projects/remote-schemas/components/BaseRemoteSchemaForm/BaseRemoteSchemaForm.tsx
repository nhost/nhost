import { useDialog } from '@/components/common/DialogProvider';
import { Form } from '@/components/form/Form';
import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import type { DialogFormProps } from '@/types/common';
import { useEffect } from 'react';
import { useFormState } from 'react-hook-form';
import * as Yup from 'yup';
import AdditionalHeadersEditor from './AdditionalHeadersEditor';
import ForwardClientHeadersToggle from './ForwardClientHeadersToggle';
import GraphQLCustomizations from './GraphQLCustomizations';
import GraphQLServerTimeoutInput from './GraphQLServerTimeoutInput';
import GraphQLServiceURLInput from './GraphQLServiceURLInput';
import RemoteSchemaCommentInput from './RemoteSchemaCommentInput';
import RemoteSchemaNameInput from './RemoteSchemaNameInput';

type RequireFields<T, K extends keyof T> = T & Required<Pick<T, K>>;

type YupInferred = Yup.InferType<typeof baseRemoteSchemaValidationSchema>;

export type BaseRemoteSchemaFormValues = YupInferred & {
  definition: RequireFields<
    YupInferred['definition'],
    'url' | 'forward_client_headers' | 'timeout_seconds'
  >;
};

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
}

export const baseRemoteSchemaValidationSchema = Yup.object({
  name: Yup.string().required('This field is required.'),
  comment: Yup.string(),
  definition: Yup.object({
    url: Yup.string().required('This field is required.'),
    forward_client_headers: Yup.boolean().required('This field is required.'),
    headers: Yup.array().of(
      Yup.object({
        name: Yup.string().required('This field is required.'),
        value: Yup.string(),
        value_from_env: Yup.string(),
      }).test(
        'has-value-or-env',
        'Either value or value from environment variable must be provided',
        (obj) => {
          const { value, value_from_env } = obj || {};
          const hasValue = value && value.trim() !== '';
          const hasEnvValue = value_from_env && value_from_env.trim() !== '';
          return hasValue || hasEnvValue;
        },
      ),
    ),
    timeout_seconds: Yup.number().required('This field is required.'),
    customization: Yup.object({
      root_fields_namespace: Yup.string(),
      type_prefix: Yup.string(),
      type_suffix: Yup.string(),
      query_root: Yup.object({
        parent_type: Yup.string(),
        prefix: Yup.string(),
        suffix: Yup.string(),
      }),
      mutation_root: Yup.object({
        parent_type: Yup.string(),
        prefix: Yup.string(),
        suffix: Yup.string(),
      }),
    }),
  }).required('This field is required.'),
});

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
    <Box className="grid flex-shrink-0 grid-flow-col justify-between gap-3 border-t-1 p-2">
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
    </Box>
  );
}

export default function BaseRemoteSchemaForm({
  location,
  onSubmit: handleExternalSubmit,
  onCancel,
  submitButtonText = 'Save',
}: BaseRemoteSchemaFormProps) {
  return (
    <Form
      onSubmit={handleExternalSubmit}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto pb-4">
        <Box component="section" className="flex flex-col gap-3 px-6 py-6">
          <RemoteSchemaNameInput />
          <RemoteSchemaCommentInput />
        </Box>

        <Box
          component="section"
          className="flex flex-col gap-3 border-t-1 px-6 py-6"
        >
          <GraphQLServiceURLInput />
          <GraphQLServerTimeoutInput />
        </Box>

        <Box
          component="section"
          className="flex flex-col gap-3 border-t-1 px-6 py-6"
        >
          <Text variant="h2" className="text-sm+ font-bold">
            Headers for remote GraphQL server
          </Text>
          <ForwardClientHeadersToggle />
          <AdditionalHeadersEditor />
          <GraphQLCustomizations />
        </Box>
      </div>

      <FormFooter
        onCancel={onCancel}
        submitButtonText={submitButtonText}
        location={location}
      />
    </Form>
  );
}
