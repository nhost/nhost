import { PlusCircleIcon } from '@/components/ui/v2/icons/PlusCircleIcon';
import { PlusIcon } from '@/components/ui/v2/icons/PlusIcon';
import type { Meta, StoryFn } from '@storybook/react';
import type { ButtonProps } from './Button';
import Button from './Button';

export default {
  title: 'UI Library / Button',
  component: Button,
  argTypes: {
    variant: {
      options: ['contained', 'outlined', 'borderless'],
      control: { type: 'radio' },
    },
    color: {
      options: ['primary', 'secondary', 'error'],
      control: { type: 'radio' },
    },
    disabled: {
      control: { type: 'boolean' },
    },
    size: {
      options: ['small', 'medium', 'large'],
      control: { type: 'radio' },
    },
  },
} as Meta<typeof Button>;

const Template: StoryFn<ButtonProps> = function TemplateFunction(
  args: ButtonProps,
) {
  return <Button {...args} />;
};

export const Primary = Template.bind({});
Primary.args = {
  children: 'Button',
  color: 'primary',
};

export const PrimaryOutlined = Template.bind({});
PrimaryOutlined.args = {
  children: 'Button',
  variant: 'outlined',
  color: 'primary',
};

export const PrimaryBorderless = Template.bind({});
PrimaryBorderless.args = {
  children: 'Button',
  variant: 'borderless',
  color: 'primary',
};

export const Secondary = Template.bind({});
Secondary.args = {
  children: 'Button',
  color: 'secondary',
};

export const SecondaryOutlined = Template.bind({});
SecondaryOutlined.args = {
  children: 'Button',
  variant: 'outlined',
  color: 'secondary',
};

export const SecondaryBorderless = Template.bind({});
SecondaryBorderless.args = {
  children: 'Button',
  variant: 'borderless',
  color: 'secondary',
};

export const Danger = Template.bind({});
Danger.args = {
  children: 'Button',
  color: 'error',
};

export const DangerOutlined = Template.bind({});
DangerOutlined.args = {
  children: 'Button',
  variant: 'outlined',
  color: 'error',
};

export const DangerBorderless = Template.bind({});
DangerBorderless.args = {
  children: 'Button',
  variant: 'borderless',
  color: 'error',
};

export const Small = Template.bind({});
Small.args = {
  children: 'Button',
  variant: 'contained',
  color: 'primary',
  size: 'small',
};

export const Large = Template.bind({});
Large.args = {
  children: 'Button',
  variant: 'contained',
  color: 'primary',
  size: 'large',
};

export const WithStartIcon = Template.bind({});
WithStartIcon.args = {
  children: 'Button',
  variant: 'contained',
  color: 'primary',
  startIcon: <PlusIcon />,
};

export const WithEndIcon = Template.bind({});
WithEndIcon.args = {
  children: 'Button',
  variant: 'contained',
  color: 'primary',
  endIcon: <PlusCircleIcon />,
};
