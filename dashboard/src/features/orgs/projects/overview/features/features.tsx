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
    description: 'Design tables and query Postgres',
    icon: <DatabaseIcon className="text-muted-foreground" />,
    link: 'https://docs.nhost.io/products/database',
  },
  {
    title: 'GraphQL API',
    description: 'Read and write data with GraphQL',
    icon: <GraphQLIcon className="text-muted-foreground" />,
    link: 'https://docs.nhost.io/products/graphql',
  },
  {
    title: 'Authentication',
    description: 'Sign users in to your app',
    icon: <UserIcon className="text-muted-foreground" />,
    link: 'https://docs.nhost.io/products/auth',
  },
  {
    title: 'Storage',
    description: 'Upload and serve files',
    icon: <StorageIcon className="text-muted-foreground" />,
    link: 'https://docs.nhost.io/products/storage',
  },
];

export default features;
