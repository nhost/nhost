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
  return <RuleGroupEditor {...args} />;
};

export const Default = Template.bind({});
Default.args = {};
