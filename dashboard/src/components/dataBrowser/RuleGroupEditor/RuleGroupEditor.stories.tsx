import type { RuleGroup } from '@/types/dataBrowser';
import type { ComponentMeta, ComponentStory } from '@storybook/react';
import { FormProvider, useForm } from 'react-hook-form';
import type { RuleGroupEditorProps } from './RuleGroupEditor';
import RuleGroupEditor from './RuleGroupEditor';

export default {
  title: 'RuleGroupEditor',
  component: RuleGroupEditor,
} as ComponentMeta<typeof RuleGroupEditor>;

const Template: ComponentStory<typeof RuleGroupEditor> = function Template(
  args: RuleGroupEditorProps,
) {
  const form = useForm<RuleGroup>({
    defaultValues: {
      operation: '_and',
      rules: [{ column: '', operator: '_eq', value: '' }],
      groups: [],
    },
  });

  // note: Storybook passes `onRemove` as a prop, but we don't want to use it
  return (
    <FormProvider {...form}>
      <RuleGroupEditor {...args} name="groups" onRemove={null} />
    </FormProvider>
  );
};

export const Default = Template.bind({});
Default.args = {};
