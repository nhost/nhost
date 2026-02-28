import { Funnel } from 'lucide-react';
import { type ForwardedRef, forwardRef } from 'react';
import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { useDataGridQueryParams } from '@/features/orgs/projects/database/dataGrid/components/DataBrowserGrid/DataGridQueryParamsProvider';
import { cn } from '@/lib/utils';

export default forwardRef(
  (props: ButtonProps, ref: ForwardedRef<HTMLButtonElement>) => {
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
          <span className="absolute right-[6px] bottom-[6px] w-[0.725rem] rounded-full bg-primary-text p-0 text-[0.725rem] text-paper leading-none">
            {numberOfAppliedFilters}
          </span>
        )}
      </Button>
    );
  },
);
