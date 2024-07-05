import { Option } from '@/components/ui/v2/Option';
import { Select } from '@/components/ui/v2/Select';
import { useGetCountriesQuery } from '@/utils/__generated__/graphql';

export type CountrySelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

export default function CountrySelector({
  value,
  onChange,
}: CountrySelectorProps) {
  const { data, error } = useGetCountriesQuery();

  if (error) {
    throw error;
  }

  const { countries } = data || {};

  return (
    <Select
      fullWidth
      value={value || null}
      onChange={(_event, inputValue) => onChange(inputValue as string)}
      placeholder="Select Country"
      slotProps={{
        listbox: { className: 'min-w-0 w-full' },
        popper: {
          disablePortal: false,
          className: 'z-[10000] w-[270px]',
        },
      }}
    >
      {countries?.map((country) => (
        <Option key={country.name} value={country.code}>
          {country.name}
        </Option>
      ))}
    </Select>
  );
}
