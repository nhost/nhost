import { XIcon } from '@/components/ui/v2/icons/XIcon';
import type { ComponentMeta, ComponentStory } from '@storybook/react';
import type { ChipProps } from './Chip';
import Chip from './Chip';

export default {
  title: 'UI Library / Chip',
  component: Chip,
  argTypes: {
    variant: {
      options: ['contained', 'outlined'],
      control: { type: 'radio' },
    },
    color: {
      options: ['primary', 'secondary', 'error', 'info'],
      control: { type: 'radio' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    size: {
      options: ['small', 'medium'],
      control: { type: 'radio' },
    },
  },
} as ComponentMeta<typeof Chip>;

const Template: ComponentStory<typeof Chip> = function Template(
  args: ChipProps,
) {
  return <Chip {...args} />;
};

export const Primary = Template.bind({});
Primary.args = {
  label: 'Chip',
  color: 'primary',
};

export const PrimaryOutlined = Template.bind({});
PrimaryOutlined.args = {
  label: 'Chip',
  variant: 'outlined',
  color: 'primary',
};

export const Secondary = Template.bind({});
Secondary.args = {
  label: 'Chip',
  color: 'secondary',
};

export const SecondaryOutlined = Template.bind({});
SecondaryOutlined.args = {
  label: 'Chip',
  variant: 'outlined',
  color: 'secondary',
};

export const Danger = Template.bind({});
Danger.args = {
  label: 'Chip',
  color: 'error',
};

export const DangerOutlined = Template.bind({});
DangerOutlined.args = {
  label: 'Chip',
  variant: 'outlined',
  color: 'error',
};

export const Small = Template.bind({});
Small.args = {
  label: 'Chip',
  color: 'primary',
  size: 'small',
};

export const WithDeleteIcon = Template.bind({});
WithDeleteIcon.args = {
  label: 'Chip',
  color: 'primary',
  deleteIcon: <XIcon />,
  onDelete: () => {},
};
