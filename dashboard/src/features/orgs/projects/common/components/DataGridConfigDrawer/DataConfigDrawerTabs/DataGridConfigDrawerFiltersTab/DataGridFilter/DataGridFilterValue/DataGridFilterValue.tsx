import { Input } from '@/components/ui/v3/input';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { cn, isNotEmptyValue } from '@/lib/utils';
import DataGridFilterValuePopup from './DataGridFilterValuePopup';

type FilterValueProps = {
  value: string;
  error?: string;
  index: number;
  disabled: boolean;
};

function DataGridFilterValue({
  value,
  error,
  index,
  disabled,
}: FilterValueProps) {
  const { setValue } = useDataGridQueryParams();
  return (
    <div className="group relative flex-1">
      <Input
        className={cn('h-8 p-2', {
          'border-destructive': isNotEmptyValue(error),
        })}
        placeholder="Enter a value"
        value={value}
        onChange={(event) => setValue(index, event.target.value)}
        disabled={disabled}
      />
      <span
        className={`mb-2 inline-flex h-[0.875rem] text-xs- text-destructive ${isNotEmptyValue(error) ? 'visible' : 'invisible'}`}
      >
        {error}
      </span>
      <DataGridFilterValuePopup
        value={value}
        onChange={(event) => setValue(index, event.target.value)}
      />
    </div>
  );
}

export default DataGridFilterValue;
