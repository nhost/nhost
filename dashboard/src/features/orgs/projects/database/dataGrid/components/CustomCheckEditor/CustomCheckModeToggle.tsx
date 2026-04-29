import { Button } from '@/components/ui/v3/button';
import { cn } from '@/lib/utils';
import {
  type CustomCheckEditorMode,
  useCustomCheckMode,
} from './CustomCheckModeProvider';

const options: { value: CustomCheckEditorMode; label: string }[] = [
  { value: 'builder', label: 'Visual' },
  { value: 'json', label: 'JSON' },
];

export default function CustomCheckModeToggle() {
  const { mode, setMode } = useCustomCheckMode();

  return (
    <div className="flex items-center gap-2">
      <span className="text-muted-foreground text-xs">Edit as:</span>
      <fieldset
        aria-label="Editor mode"
        className="inline-flex items-center gap-0.5 rounded-md border border-border bg-muted p-0.5"
      >
        {options.map(({ value, label }) => {
          const isActive = mode === value;
          return (
            <Button
              key={value}
              type="button"
              aria-pressed={isActive}
              variant="ghost"
              size="sm"
              className={cn(
                'h-7 px-2.5 text-xs',
                isActive
                  ? 'bg-background shadow-sm hover:bg-background'
                  : 'text-muted-foreground hover:bg-transparent hover:text-foreground',
              )}
              onClick={() => setMode(value)}
            >
              {label}
            </Button>
          );
        })}
      </fieldset>
    </div>
  );
}
