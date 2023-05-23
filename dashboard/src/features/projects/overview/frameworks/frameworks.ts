import type { CardProps } from '@/features/projects/overview/types/cards';

const frameworks: CardProps[] = [
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

export default frameworks;
