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
  /**
   * Whether the name input should be disabled.
   */
  nameInputDisabled?: boolean;
  /**
   * Optional slot to override the default GraphQL customizations section.
   */
  graphQLCustomizationsSlot?: React.ReactNode;
}

export const baseRemoteSchemaValidationSchema = Yup.object({
  name: Yup.string().required('Name is required.'),
  comment: Yup.string(),
  definition: Yup.object({
    url: Yup.string()
      .url('Invalid service URL.')
      .required('Service URL is required.'),
    forward_client_headers: Yup.boolean().required(
      'Forward client headers is required.',
    ),
    headers: Yup.array().of(
      Yup.object({
        name: Yup.string().required('Header name is required.'),
        value: Yup.string(),
        value_from_env: Yup.string(),
      }).test(
        'has-value-or-env',
        'Either value or value from environment variable must be provided.',
        (obj) => {
          const { value, value_from_env } = obj || {};
          const hasValue = (value ?? '').trim() !== '';
          const hasEnvValue = (value_from_env ?? '').trim() !== '';
          return hasValue || hasEnvValue;
        },
      ),
    ),
    timeout_seconds: Yup.number()
      .required('Timeout is required.')
      .positive('Timeout must be a positive number.')
      .typeError('Timeout must be a number.'),
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
  }).required('Definition is required.'),
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
        disabled={isSubmitting || !isDirty}
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
  nameInputDisabled = false,
  graphQLCustomizationsSlot,
}: BaseRemoteSchemaFormProps) {
  return (
    <Form
      onSubmit={handleExternalSubmit}
      className="flex flex-auto flex-col content-between overflow-hidden border-t-1"
    >
      <div className="flex-auto overflow-y-auto pb-4">
        <Box
          component="section"
          className="flex flex-col gap-3 px-6 py-6 md:grid md:grid-cols-8"
        >
          <div className="col-span-6">
            <RemoteSchemaNameInput disabled={nameInputDisabled} />
          </div>
          <div className="col-span-6">
            <RemoteSchemaCommentInput />
          </div>
        </Box>

        <Box
          component="section"
          className="flex flex-col gap-3 border-t-1 px-6 py-6 md:grid md:grid-cols-8"
        >
          <div className="col-span-6">
            <GraphQLServiceURLInput />
          </div>
          <div className="col-span-6">
            <GraphQLServerTimeoutInput />
          </div>
        </Box>

        <Box
          component="section"
          className="flex flex-col gap-3 border-t-1 px-6 py-6"
        >
          <Text variant="h4" className="text-lg font-semibold">
            Headers for remote GraphQL server
          </Text>
          <ForwardClientHeadersToggle />
          <AdditionalHeadersEditor />
          {graphQLCustomizationsSlot ?? <GraphQLCustomizations />}
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
