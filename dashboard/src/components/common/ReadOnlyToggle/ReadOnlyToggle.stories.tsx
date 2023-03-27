import type { ComponentMeta, ComponentStory } from '@storybook/react';
import type { PropsWithoutRef } from 'react';

import type { ReadOnlyToggleProps } from './ReadOnlyToggle';
import ReadOnlyToggle from './ReadOnlyToggle';

export default {
  title: 'Common Components / ReadOnlyToggle',
  component: ReadOnlyToggle,
  argTypes: {
    checked: {
      options: [null, true, false],
      control: { type: 'radio' },
    },
  },
} as ComponentMeta<typeof ReadOnlyToggle>;

const Template: ComponentStory<typeof ReadOnlyToggle> = function Template(
  args: PropsWithoutRef<ReadOnlyToggleProps>,
) {
  return <ReadOnlyToggle {...args} />;
};

export const Null = Template.bind({});
Null.args = {
  checked: null,
};

export const True = Template.bind({});
True.args = {
  checked: true,
};

export const False = Template.bind({});
False.args = {
  checked: false,
};

export const CustomClasses = Template.bind({});
CustomClasses.args = {
  checked: true,
  className: '!bg-red-500',
  slotProps: {
    label: {
      className: '!text-sm !text-white',
    },
  },
};
