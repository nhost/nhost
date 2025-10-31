import { Button } from '@/components/ui/v3/button';
import { Checkbox } from '@/components/ui/v3/checkbox';
import { Label } from '@/components/ui/v3/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/v3/popover';
import { RadioGroup, RadioGroupItem } from '@/components/ui/v3/radio-group';
import { useDataTableDesignContext } from '@/pages/orgs/[orgSlug]/projects/[appSubdomain]/database/browser/[dataSourceSlug]/[schemaSlug]/test';
import { Settings } from 'lucide-react';

function DataTableDesignPopup() {
  const context = useDataTableDesignContext();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline" size="icon">
          <Settings />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80">
        <div className="grid gap-4">
          <div className="space-y-2">
            <h4 className="font-medium leading-none">Dimensions</h4>
            <p className="text-sm text-muted-foreground">
              Set height of the rows
            </p>
            <RadioGroup
              className="flex flex-col space-y-1"
              defaultValue={context.rowHeight}
              value={context.rowHeight}
              onValueChange={context.setRowHeight}
            >
              <div className="flex justify-start gap-3">
                <RadioGroupItem value="3rem" id="height1" />
                <Label htmlFor="height1">Original Height (48px)</Label>
              </div>
              <div className="flex justify-start gap-3">
                <RadioGroupItem value="2rem" id="height2" />
                <Label htmlFor="height2">Compact(32px)</Label>
              </div>
            </RadioGroup>
          </div>
          <div className="flex items-center justify-start gap-3">
            <Checkbox
              id="hideColumnBorders"
              checked={context.hideColumnBorders}
              onCheckedChange={context.toggleColumnBorder}
            />
            <Label htmlFor="hideColumnBorders">
              Hide column borders (vertical)
            </Label>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export default DataTableDesignPopup;
