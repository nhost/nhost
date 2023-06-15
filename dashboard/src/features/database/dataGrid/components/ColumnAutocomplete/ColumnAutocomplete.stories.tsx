import { Form } from '@/components/form/Form';
import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import hasuraMetadataQuery from '@/tests/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/tests/msw/mocks/rest/tableQuery';
import tokenQuery from '@/tests/msw/mocks/rest/tokenQuery';
import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { ColumnAutocompleteProps } from './ColumnAutocomplete';
import ColumnAutocomplete from './ColumnAutocomplete';

export default {
  title: 'Data Browser / ColumnAutocomplete',
  component: ColumnAutocomplete,
  parameters: {
    docs: {
      source: {
        type: 'code',
      },
    },
  },
} as ComponentMeta<typeof ColumnAutocomplete>;

const defaultParameters = {
  nextRouter: {
    path: '/[workspaceSlug]/[appSlug]/database/browser/[dataSourceSlug]/[schemaSlug]/[tableSlug]',
    asPath: '/workspace/app/database/browser/default/public/users',
    query: {
      workspaceSlug: 'workspace',
      appSlug: 'app',
      dataSourceSlug: 'default',
      schemaSlug: 'public',
      tableSlug: 'books',
    },
  },
  msw: {
    handlers: [tokenQuery, tableQuery, hasuraMetadataQuery],
  },
};

const Template: ComponentStory<typeof ColumnAutocomplete> = function Template(
  args: ColumnAutocompleteProps,
) {
  const [submittedValues, setSubmittedValues] = useState<string>('');

  const form = useForm<{ firstReference: string; secondReference: string }>({
    defaultValues: {
      firstReference: null,
      secondReference: null,
    },
  });

  function handleSubmit(values: {
    firstReference: string;
    secondReference: string;
  }) {
    setSubmittedValues(JSON.stringify(values, null, 2));
  }

  return (
    <div className="grid grid-flow-row gap-2">
      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-2">
          <ColumnAutocomplete
            {...args}
            name="firstReference"
            label="First Reference"
            onChange={(_event, newValue) =>
              form.setValue('firstReference', newValue.value, {
                shouldDirty: true,
              })
            }
            onInitialized={(newValue) => {
              form.setValue('firstReference', newValue.value, {
                shouldDirty: true,
              });
            }}
          />
          <ColumnAutocomplete
            {...args}
            name="secondReference"
            label="Second Reference"
            onChange={(_event, newValue) =>
              form.setValue('secondReference', newValue.value, {
                shouldDirty: true,
              })
            }
            onInitialized={(newValue) => {
              form.setValue('secondReference', newValue.value, {
                shouldDirty: true,
              });
            }}
          />

          <Button type="submit" className="justify-self-start">
            Submit
          </Button>
        </Form>
      </FormProvider>

      <Text component="pre" className="!font-mono !text-gray-700">
        {submittedValues || 'The form has not been submitted yet.'}
      </Text>
    </div>
  );
};

export const Basic = Template.bind({});
Basic.args = {
  schema: 'public',
  table: 'books',
};
Basic.parameters = defaultParameters;

export const DefaultValue = Template.bind({});
DefaultValue.args = {
  schema: 'public',
  table: 'books',
  value: 'author.id',
};
DefaultValue.parameters = defaultParameters;

export const DisabledRelationships = Template.bind({});
DisabledRelationships.args = {
  schema: 'public',
  table: 'books',
  disableRelationships: true,
};
DisabledRelationships.parameters = defaultParameters;
