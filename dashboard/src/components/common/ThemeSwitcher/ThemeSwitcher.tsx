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

type ThemeSwitcherLayout = 'desktop' | 'mobile';

export interface ThemeSwitcherProps {
  className?: string;
  layout?: ThemeSwitcherLayout;
}

export default function ThemeSwitcher({
  className,
  layout = 'desktop',
}: ThemeSwitcherProps) {
  const { themePreference, setThemePreference } = useThemePreference();
  const selectId = useId();
  const isMobile = layout === 'mobile';

  const handleValueChange = (value: string) => {
    const preference = value as ThemePreference;

    setThemePreference(preference);
  };

  return (
    <div
      className={cn(
        isMobile
          ? 'grid grid-flow-row gap-3'
          : 'grid grid-cols-[auto_minmax(8rem,1fr)] items-center gap-3 px-2',
        className,
      )}
    >
      <label
        htmlFor={selectId}
        className={cn(
          isMobile ? 'font-semibold text-xl' : 'font-medium text-sm+',
        )}
      >
        Theme
      </label>

      <Select value={themePreference} onValueChange={handleValueChange}>
        <SelectTrigger id={selectId} className="min-w-0">
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
