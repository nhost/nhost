import { Button } from '@/components/ui/v3/button';
import { useDataGridQueryParams } from './DataGridQueryParamsProvider';

function NoMatchesFound() {
  const { setAppliedFilters } = useDataGridQueryParams();

  function onResetFilters() {
    setAppliedFilters([]);
  }

  return (
    <p className="text-xs">
      No matches found -{' '}
      <Button
        variant="link"
        className="pl-0 text-xs hover:no-underline"
        onClick={onResetFilters}
      >
        Click here to reset your filters
      </Button>
    </p>
  );
}

export default NoMatchesFound;
