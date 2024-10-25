import type { CardProps } from '@/features/projects/overview/types/cards';

const frameworks: CardProps[] = [
  {
    title: 'React',
    description: 'Guide to build a simple React app',
    icon: '/assets/frameworks/react.svg',
    link: 'https://docs.nhost.io/guides/quickstarts/react',
    iconIsComponent: false,
  },
  {
    title: 'Next.js',
    description: 'Nhost helps you to build with Next.js',
    icon: '/assets/frameworks/nextjs.svg',
    lightIcon: '/assets/frameworks/light/nextjs.svg',
    disableIconBackground: true,
    link: 'https://docs.nhost.io/guides/quickstarts/nextjs',
    iconIsComponent: false,
  },
  {
    title: 'Vue.js',
    description: 'Learn how to use Vue.js with Nhost',
    icon: '/assets/frameworks/vue.svg',
    link: 'https://docs.nhost.io/guides/quickstarts/vue',
    iconIsComponent: false,
  },
];

export default frameworks;
