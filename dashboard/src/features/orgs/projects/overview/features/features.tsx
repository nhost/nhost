import { DatabaseIcon } from '@/components/ui/v2/icons/DatabaseIcon';
import { GraphQLIcon } from '@/components/ui/v2/icons/GraphQLIcon';
import { StorageIcon } from '@/components/ui/v2/icons/StorageIcon';
import { UserIcon } from '@/components/ui/v2/icons/UserIcon';
import type { CardProps } from '@/features/orgs/projects/overview/types/cards';

const features: CardProps[] = [
  {
    title: 'Database',
    description: 'Learn how to use Postgres with Nhost',
    icon: <DatabaseIcon className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/database/overview',
  },
  {
    title: 'GraphQL API',
    description: 'Learn how to interact with the GraphQL API',
    icon: <GraphQLIcon className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/graphql/overview',
  },
  {
    title: 'Authentication',
    description: 'Learn how to authenticate users with Nhost',
    icon: <UserIcon className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/auth/overview',
  },
  {
    title: 'Storage',
    description: 'Learn how to use Storage with Nhost',
    icon: <StorageIcon className="h-8 w-8" sx={{ color: 'text.secondary' }} />,
    disableIconBackground: true,
    link: 'https://docs.nhost.io/products/storage/overview',
  },
];

export default features;
