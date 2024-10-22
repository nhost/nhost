import { Option } from '@/components/ui/v2/Option';
import type { SelectProps } from '@/components/ui/v2/Select';
import { Select } from '@/components/ui/v2/Select';
import { useColorPreference } from '@/components/ui/v2/useColorPreference';

export interface ThemeSwitcherProps extends SelectProps<any> {}

export default function ThemeSwitcher({
  onChange,
  ...props
}: ThemeSwitcherProps) {
  const { colorPreference, setColorPreference } = useColorPreference();

  return (
    <Select
      {...props}
      id="theme-switcher"
      value={colorPreference}
      onChange={(event, value) => {
        setColorPreference(value as typeof colorPreference);

        onChange?.(event, value);
      }}
      slotProps={{
        ...props?.slotProps,
        listbox: { className: 'min-w-0 w-full' },
        popper: {
          disablePortal: false,
          className: 'z-[10000] w-[270px]',
        },
      }}
    >
      <Option value="light">Light</Option>
      <Option value="dark">Dark</Option>
      <Option value="system">System</Option>
    </Select>
  );
}
