import { SiSvelte as SvelteIcon } from '@icons-pack/react-simple-icons';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';

const frameworks: CardProps[] = [
  {
    title: 'React',
    description: 'Build a React app with Nhost',
    icon: '/assets/frameworks/react.svg',
    link: 'https://docs.nhost.io/getting-started/quickstart/react',
    iconIsComponent: false,
  },
  {
    title: 'Next.js',
    description: 'Build a Next.js app with Nhost',
    icon: '/assets/frameworks/nextjs.svg',
    lightIcon: '/assets/frameworks/light/nextjs.svg',
    link: 'https://docs.nhost.io/getting-started/quickstart/nextjs',
    iconIsComponent: false,
  },
  {
    title: 'Vue.js',
    description: 'Build a Vue app with Nhost',
    icon: '/assets/frameworks/vue.svg',
    link: 'https://docs.nhost.io/getting-started/quickstart/vue',
    iconIsComponent: false,
  },
  {
    title: 'SvelteKit',
    description: 'Build a SvelteKit app with Nhost',
    icon: <SvelteIcon color="default" />,
    link: 'https://docs.nhost.io/getting-started/quickstart/sveltekit',
  },
];

export default frameworks;
