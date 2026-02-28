import type { ChangeEvent, KeyboardEvent } from 'react';
import { Input } from '@/components/ui/v3/input';
import { useDataGridFilters } from '@/features/orgs/projects/common/components/DataGridFiltersPopover/DataGridFiltersProvider';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { useRemoveQueryParamsFromUrl } from '@/hooks/useRemoveQueryParamsFromUrl';
import DataGridFilterValuePopup from './DataGridFilterValuePopup';

type FilterValueProps = {
  value: string;
  index: number;
  disabled: boolean;
};

function DataGridFilterValue({ value, index, disabled }: FilterValueProps) {
  const { setValue, filters } = useDataGridFilters();
  const { setAppliedFilters, setCurrentOffset } = useDataGridQueryParams();
  const removeQueryParamsFromUrl = useRemoveQueryParamsFromUrl();

  function handleKeyUp(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      removeQueryParamsFromUrl('page');
      setCurrentOffset(0);
      setAppliedFilters(filters);
    }
  }

  function handleValueChange(
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) {
    setValue(index, event.target.value);
  }

  return (
    <div className="relative flex-1">
      <Input
        className="h-8 p-2 pr-8"
        placeholder="Enter a value"
        value={value}
        onChange={handleValueChange}
        onKeyUp={handleKeyUp}
        disabled={disabled}
      />
      {!disabled && (
        <DataGridFilterValuePopup value={value} onChange={handleValueChange} />
      )}
    </div>
  );
}

export default DataGridFilterValue;
