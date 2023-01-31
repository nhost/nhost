import type { BoxProps } from '@/ui/v2/Box';
import type { ReactElement } from 'react';

export interface CardElement extends BoxProps {
  /**
   * Title for the framework.
   */
  title: string;
  /**
   * Description of the framework.
   */
  description: string;
  /**
   * Icon to display on the card.
   */
  icon: string | ReactElement;
  /**
   * Light version of the icon. This is used for the dark mode.
   */
  lightIcon?: string | ReactElement;
  /**
   * Determines whether the icon should have a background.
   * @default false
   */
  disableIconBackground?: boolean;
  /**
   * Determines whether the icon is a react component.
   * @default true
   */
  iconIsComponent?: boolean;
  /**
   * Link to the specific framework documentation.
   */
  link?: string;
}

export const frameworks: CardElement[] = [
  {
    title: 'React',
    description: 'Guide to build a simple React app',
    icon: '/assets/frameworks/react.svg',
    link: 'https://docs.nhost.io/platform/quickstarts/react',
    iconIsComponent: false,
  },
  {
    title: 'Next.js',
    description: 'Nhost helps you to build with Next.js',
    icon: '/assets/frameworks/nextjs.svg',
    lightIcon: '/assets/frameworks/light/nextjs.svg',
    disableIconBackground: true,
    link: 'https://docs.nhost.io/platform/quickstarts/nextjs',
    iconIsComponent: false,
  },
  {
    title: 'RedwoodJS',
    description: 'Quickstart for RedwoodJS on Nhost',
    icon: '/assets/frameworks/redwood.svg',
    link: 'https://docs.nhost.io/platform/quickstarts/redwoodjs',
    iconIsComponent: false,
  },
  {
    title: 'Vue.js',
    description: 'Learn how to use Vue.js with Nhost',
    icon: '/assets/frameworks/vue.svg',
    link: 'https://docs.nhost.io/platform/quickstarts/vue',
    iconIsComponent: false,
  },
];
