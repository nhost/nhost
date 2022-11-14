import { Search } from '@/components/dashboard/Search';
import Button from '@/ui/v2/Button';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import Text from '@/ui/v2/Text';
import Link from 'next/link';

interface IndexHeaderAppsProps {
  query?: any;
  setQuery?: any;
}

export function IndexHeaderApps({ query, setQuery }: IndexHeaderAppsProps) {
  return (
    <div className="mx-auto mb-6 grid w-full grid-flow-col place-content-between items-center py-2">
      <Text variant="h2" component="h1" className="hidden md:block">
        My Projects
      </Text>

      <Search
        width="w-form"
        placeholder="Find Project"
        value={query}
        background="bg-header"
        border=""
        onChange={(e) => {
          e.preventDefault();
          setQuery(e.target.value);
        }}
      />

      <Link href="/new" passHref>
        <Button
          variant="outlined"
          color="secondary"
          startIcon={<PlusCircleIcon />}
        >
          New Project
        </Button>
      </Link>
    </div>
  );
}

export default IndexHeaderApps;
