import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';
import { Database, HardDrive, User } from 'lucide-react';
const features: CardProps[] = [
  {
title: 'Database',
    description: 'Learn how to use Postgres with Nhost',
    icon: <Database className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/database',
  },
  {
    title: 'GraphQL API',
    description: 'Learn how to interact with the GraphQL API',
    icon: <GraphQLIcon className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/graphql',
  },
  {
    title: 'Authentication',
    description: 'Learn how to authenticate users with Nhost',
    icon: <User className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/auth',
  },
  {
    title: 'Storage',
    description: 'Learn how to use Storage with Nhost',
    icon: <HardDrive className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/storage',
  },
];

export default features;
