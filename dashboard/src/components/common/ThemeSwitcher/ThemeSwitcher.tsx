import { Monitor, Moon, Sun } from 'lucide-react';
import type { ComponentType } from 'react';
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/v3/toggle-group';
import { cn } from '@/lib/utils';
import { type ThemePreference, useThemePreference } from '@/providers/Theme';

const themeOptions: {
  value: ThemePreference;
  label: string;
  icon: ComponentType<{ className?: string }>;
}[] = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor },
];

export interface ThemeSwitcherProps {
  className?: string;
}

export default function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { themePreference, setThemePreference } = useThemePreference();

  return (
    <div className={cn('grid grid-flow-row gap-2', className)}>
      <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
        Theme
      </span>

      <ToggleGroup
        type="single"
        aria-label="Theme"
        value={themePreference}
        onValueChange={(value) => {
          if (value) {
            setThemePreference(value as ThemePreference);
          }
        }}
        className="w-full gap-1 rounded-md bg-muted p-1"
      >
        {themeOptions.map(({ value, label, icon: Icon }) => (
          <ToggleGroupItem
            key={value}
            value={value}
            aria-label={label}
            className="h-8 flex-1 gap-1.5 rounded-sm text-muted-foreground text-sm hover:bg-transparent data-[state=on]:bg-background data-[state=on]:text-foreground data-[state=on]:shadow-sm"
          >
            <Icon className="h-4 w-4" />
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}
