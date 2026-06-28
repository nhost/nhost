import { SiGraphql as GraphQLIcon } from '@icons-pack/react-simple-icons';

import {
  Database as DatabaseIcon,
  HardDrive as StorageIcon,
  User as UserIcon,
} from 'lucide-react';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';

const features: CardProps[] = [
  {
    title: 'Database',
    description: 'Learn how to use Postgres with Nhost',
    icon: <DatabaseIcon className="h-8 w-8 text-muted-foreground" />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/database',
  },
  {
    title: 'GraphQL API',
    description: 'Learn how to interact with the GraphQL API',
    icon: <GraphQLIcon className="h-8 w-8 text-muted-foreground" />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/graphql',
  },
  {
    title: 'Authentication',
    description: 'Learn how to authenticate users with Nhost',
    icon: <UserIcon className="h-8 w-8 text-muted-foreground" />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/auth',
  },
  {
    title: 'Storage',
    description: 'Learn how to use Storage with Nhost',
    icon: <StorageIcon className="h-8 w-8 text-muted-foreground" />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/storage',
  },
];

export default features;
