import { Option } from '@/components/ui/v2/Option';
import type { Meta, StoryFn } from '@storybook/react';
import type { SelectProps } from './Select';
import Select from './Select';

export default {
  title: 'UI Library / Select',
  component: Select,
  argTypes: {},
} as Meta<typeof Select>;

const Template: StoryFn<SelectProps<any>> = function TemplateFunction(args) {
  return (
    <Select className="w-64" {...args}>
      <Option value="value1">Value 1</Option>
      <Option value="value2">Value 2</Option>
      <Option value="value3">Value 3</Option>
      <Option value="value4">Value 4</Option>
    </Select>
  );
};

export const Default = Template.bind({});
Default.args = {
  defaultValue: 'value1',
};

export const WithLabel = Template.bind({});
WithLabel.args = {
  label: 'Label',
};

export const Disabled = Template.bind({});
Disabled.args = {
  label: 'Label',
  disabled: true,
  defaultValue: 'value1',
};
