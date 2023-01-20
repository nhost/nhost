import Option from '@/ui/v2/Option';
import type { SelectProps } from '@/ui/v2/Select';
import Select from '@/ui/v2/Select';
import useColorPreference from '@/ui/v2/useColorPreference';

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
    >
      <Option value="light">Light</Option>
      <Option value="dark">Dark</Option>
      <Option value="system">System</Option>
    </Select>
  );
}
