import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';

export type SchemaView = 'tree' | 'raw';

const itemClassName =
  'h-7 min-w-0 rounded-sm px-2.5 text-muted-foreground text-xs hover:bg-transparent hover:text-foreground data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm';

export interface SchemaViewToggleProps {
  value: SchemaView;
  onChange: (view: SchemaView) => void;
}

export default function SchemaViewToggle({
  value,
  onChange,
}: SchemaViewToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">View as:</span>
      <ToggleGroup
        type="single"
        aria-label="Schema view"
        value={value}
        onValueChange={(next) => {
          if (next) {
            onChange(next as SchemaView);
          }
        }}
        className="gap-0.5 rounded-md border border-border bg-muted p-0.5"
      >
        <ToggleGroupItem value="tree" className={itemClassName}>
          Tree
        </ToggleGroupItem>
        <ToggleGroupItem value="raw" className={itemClassName}>
          Raw
        </ToggleGroupItem>
      </ToggleGroup>
    </div>
  );
}
