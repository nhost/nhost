import type { Meta, StoryFn } from '@storybook/react';
import type { SwitchProps } from './Switch';
import Switch from './Switch';

export default {
  title: 'UI Library / Switch',
  component: Switch,
  argTypes: {},
} as Meta<typeof Switch>;

const Template: StoryFn<SwitchProps> = function TemplateFunction(
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
