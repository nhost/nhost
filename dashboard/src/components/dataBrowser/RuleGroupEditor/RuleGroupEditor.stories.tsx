import type { ComponentMeta, ComponentStory } from '@storybook/react';
import type { RuleGroupEditorProps } from './RuleGroupEditor';
import RuleGroupEditor from './RuleGroupEditor';

export default {
  title: 'RuleGroupEditor',
  component: RuleGroupEditor,
} as ComponentMeta<typeof RuleGroupEditor>;

const Template: ComponentStory<typeof RuleGroupEditor> = function Template(
  args: RuleGroupEditorProps,
) {
  // note: Storybook passes `onRemove` as a prop, but we don't want to use it
  return <RuleGroupEditor {...args} onRemove={null} />;
};

export const Default = Template.bind({});
Default.args = {};
