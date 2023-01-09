import Form from '@/components/common/Form';
import type { RuleGroup } from '@/types/dataBrowser';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import customClaimsQuery from '@/utils/msw/mocks/graphql/customClaimsQuery';
import hasuraMetadataQuery from '@/utils/msw/mocks/rest/hasuraMetadataQuery';
import tableQuery from '@/utils/msw/mocks/rest/tableQuery';
import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { useState } from 'react';
import { FormProvider, useForm } from 'react-hook-form';
import type { RuleGroupEditorProps } from './RuleGroupEditor';
import RuleGroupEditor from './RuleGroupEditor';

export default {
  title: 'Data Browser / RuleGroupEditor',
  component: RuleGroupEditor,
  parameters: {
    docs: {
      source: {
        type: 'code',
      },
    },
  },
} as ComponentMeta<typeof RuleGroupEditor>;

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
    handlers: [tableQuery, hasuraMetadataQuery, customClaimsQuery],
  },
};

const Template: ComponentStory<typeof RuleGroupEditor> = function Template(
  args: RuleGroupEditorProps,
) {
  const [submittedValues, setSubmittedValues] = useState<string>();

  const form = useForm<{ ruleGroupEditor: RuleGroup }>({
    defaultValues: {
      ruleGroupEditor: {
        operator: '_and',
        rules: [{ column: '', operator: '_eq', value: '' }],
        groups: [],
      },
    },
    reValidateMode: 'onSubmit',
  });

  function handleSubmit(values: { ruleGroupEditor: RuleGroup }) {
    setSubmittedValues(JSON.stringify(values, null, 2));
  }

  // note: Storybook passes `onRemove` as a prop, but we don't want to use it
  return (
    <div className="grid grid-flow-row gap-2">
      <FormProvider {...form}>
        <Form onSubmit={handleSubmit} className="grid grid-flow-row gap-2">
          <RuleGroupEditor
            schema="public"
            table="books"
            {...args}
            name="ruleGroupEditor"
            onRemove={null}
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

export const Default = Template.bind({});
Default.args = {};
Default.parameters = defaultParameters;

export const DisabledOperators = Template.bind({});
DisabledOperators.args = {
  disabledOperators: ['_in_hasura', '_nin_hasura', '_is_null'],
};
DisabledOperators.parameters = defaultParameters;
