import { Label } from '@/components/ui/v3/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useDataTableDesignContext } from '@/features/orgs/projects/storage/dataGrid/providers/DataTableDesignProvider';

function RowDensityCustomizer() {
  const context = useDataTableDesignContext();

  return (
    <div className="flex flex-col gap-4 pt-2">
      <div className="flex flex-col gap-4">
        <h4 className="font-medium leading-none">Density</h4>
        <p className="text-sm text-muted-foreground">
          Set row height across all tables
        </p>
      </div>
      <div>
        <RadioGroup
          className="flex flex-col space-y-1"
          defaultValue={context.rowDensity}
          value={context.rowDensity}
          onValueChange={context.setRowDensity}
        >
          <div className="flex justify-start gap-3">
            <RadioGroupItem value="comfortable" id="height1" />
            <Label htmlFor="height1" className="hover:cursor-pointer">
              Comfortable
            </Label>
          </div>
          <div className="flex justify-start gap-3">
            <RadioGroupItem value="compact" id="height2" />
            <Label htmlFor="height2" className="hover:cursor-pointer">
              Compact
            </Label>
          </div>
        </RadioGroup>
      </div>
    </div>
  );
}

export default RowDensityCustomizer;
