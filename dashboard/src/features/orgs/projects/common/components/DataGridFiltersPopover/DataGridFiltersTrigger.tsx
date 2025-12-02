import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { cn } from '@/lib/utils';
import { Funnel } from 'lucide-react';
import { type ForwardedRef, forwardRef } from 'react';

function DataGridFiltersTrigger(
  props: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const { appliedFilters } = useDataGridQueryParams();
  const numberOfAppliedFilters = appliedFilters.length;

  const { className, ...buttonProps } = props;

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className={cn('relative', className)}
      {...buttonProps}
    >
      <Funnel />
      {numberOfAppliedFilters > 0 && (
        <span className="absolute bottom-[6px] right-[6px] w-[0.725rem] rounded-full bg-primary-text p-0 text-[0.725rem] leading-none text-paper">
          {numberOfAppliedFilters}
        </span>
      )}
    </Button>
  );
}

export default forwardRef(DataGridFiltersTrigger);
