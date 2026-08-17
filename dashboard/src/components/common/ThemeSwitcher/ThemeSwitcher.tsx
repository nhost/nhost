import { useId } from 'react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/v3/select';
import { cn } from '@/lib/utils';
import { type ThemePreference, useThemePreference } from '@/providers/Theme';

export interface ThemeSwitcherProps {
  className?: string;
}

export default function ThemeSwitcher({ className }: ThemeSwitcherProps) {
  const { themePreference, setThemePreference } = useThemePreference();
  const selectId = useId();
  const labelId = `${selectId}-label`;

  const handleValueChange = (value: string) => {
    const preference = value as ThemePreference;

    setThemePreference(preference);
  };

  return (
    <div
      className={cn(
        'grid grid-flow-row gap-3 sm:grid-cols-[auto_minmax(8rem,1fr)] sm:items-center sm:px-2',
        className,
      )}
    >
      <label
        id={labelId}
        htmlFor={selectId}
        className="font-semibold text-xl sm:font-medium sm:text-sm+"
      >
        Theme
      </label>

      <Select value={themePreference} onValueChange={handleValueChange}>
        <SelectTrigger
          id={selectId}
          aria-labelledby={labelId}
          className="min-w-0"
        >
          <SelectValue placeholder="System" />
        </SelectTrigger>
        <SelectContent className="z-[10000] w-[var(--radix-select-trigger-width)] min-w-0">
          <SelectItem value="light">Light</SelectItem>
          <SelectItem value="dark">Dark</SelectItem>
          <SelectItem value="system">System</SelectItem>
        </SelectContent>
      </Select>
    </div>
  );
}
