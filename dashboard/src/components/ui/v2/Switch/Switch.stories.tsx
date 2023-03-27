import type { ComponentMeta, ComponentStory } from '@storybook/react';
import type { SwitchProps } from './Switch';
import Switch from './Switch';

export default {
  title: 'UI Library / Switch',
  component: Switch,
  argTypes: {},
} as ComponentMeta<typeof Switch>;

const Template: ComponentStory<typeof Switch> = function Template(
  args: SwitchProps,
) {
  return <Switch label="Accept Rules" {...args} />;
};

export const Default = Template.bind({});
Default.args = {};

export const Checked = Template.bind({});
Checked.args = {
  checked: true,
};

export const Disabled = Template.bind({});
Disabled.args = {
  disabled: true,
};
