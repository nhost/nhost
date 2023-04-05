import Option from '@/ui/v2/Option';
import type { SelectProps } from '@/ui/v2/Select';
import Select from '@/ui/v2/Select';
import useColorPreference from '@/ui/v2/useColorPreference';
import useTranslation from 'next-translate/useTranslation';

export interface ThemeSwitcherProps extends SelectProps<any> {}

export default function ThemeSwitcher({
  onChange,
  ...props
}: ThemeSwitcherProps) {
  const { t } = useTranslation('common');
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
        listbox: { className: 'min-w-0 w-full' },
        popper: {
          disablePortal: false,
          className: 'z-[10000] w-[270px] w-full',
        },
      }}
    >
      <Option value="light">{t('labels.light')}</Option>
      <Option value="dark">{t('labels.dark')}</Option>
      <Option value="system">{t('labels.system')}</Option>
    </Select>
  );
}
