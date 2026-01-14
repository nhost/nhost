import { Button, type ButtonProps } from '@/components/ui/v3/button';
import { useDataGridConfig } from '@/features/orgs/projects/storage/dataGrid/components/DataGridConfigProvider';
import { cn } from '@/lib/utils';
import { Columns3 } from 'lucide-react';
import { type ForwardedRef, forwardRef } from 'react';

function DataBrowserCustomizerTrigger(
  props: ButtonProps,
  ref: ForwardedRef<HTMLButtonElement>,
) {
  const { allColumns } = useDataGridConfig();
  const numberOfHiddenColumns = allColumns.filter(
    ({ isVisible }) => !isVisible,
  ).length;
  const hasHiddenColumns = numberOfHiddenColumns !== 0;

  const { className, ...buttonProps } = props;

  return (
    <Button
      ref={ref}
      variant="outline"
      size="icon"
      className={cn('relative', className)}
      {...(hasHiddenColumns && {
        title: `${numberOfHiddenColumns} ${numberOfHiddenColumns === 1 ? ' column is' : ' columns are'} hidden`,
      })}
      {...buttonProps}
    >
      <Columns3 />
      {hasHiddenColumns && (
        <span className="absolute right-[6px] bottom-[8px] w-[0.625rem] rounded-full bg-primary-text p-0 text-[0.625rem] text-paper leading-none">
          !
        </span>
      )}
    </Button>
  );
}

export default forwardRef(DataBrowserCustomizerTrigger);
