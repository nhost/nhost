import type { AnimationEvent } from 'react';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { isEmptyValue, isNotEmptyValue } from '@/lib/utils';
import DataGridFilterActions from './DataGridFilterActions';
import DataGridFilters from './DataGridFilters';
import DataGridFiltersProvider, {
  useDataGridFilters,
} from './DataGridFiltersProvider';
import DataGridFiltersTrigger from './DataGridFiltersTrigger';

function DataGridFiltersPopoverImpl() {
  const { setFilters, filters } = useDataGridFilters();
  const { appliedFilters } = useDataGridQueryParams();

  function restoreFiltersOnAnimationEndIfNeeded(
    event: AnimationEvent<HTMLDivElement>,
  ) {
    if (
      event.animationName === 'exit' &&
      isEmptyValue(filters) &&
      isNotEmptyValue(appliedFilters)
    ) {
      setFilters(appliedFilters);
    }
  }

  return (
    <Popover>
      <PopoverTrigger asChild>
        <DataGridFiltersTrigger />
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="flex flex-col gap-6 md:w-[34rem] md:max-w-[33rem]"
        onAnimationEnd={restoreFiltersOnAnimationEndIfNeeded}
      >
        <DataGridFilters />
        <DataGridFilterActions />
      </PopoverContent>
    </Popover>
  );
}

function DataGridFiltersPopover() {
  return (
    <DataGridFiltersProvider>
      <DataGridFiltersPopoverImpl />
    </DataGridFiltersProvider>
  );
}

export default DataGridFiltersPopover;
