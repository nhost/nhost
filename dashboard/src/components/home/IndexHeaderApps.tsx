import Button from '@/ui/v2/Button';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import SearchIcon from '@/ui/v2/icons/SearchIcon';
import Input from '@/ui/v2/Input';
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

      <Input
        placeholder="Find Project"
        startAdornment={
          <SearchIcon
            className="ml-2 -mr-1 h-4 w-4 shrink-0"
            sx={{ color: 'text.disabled' }}
          />
        }
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
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
