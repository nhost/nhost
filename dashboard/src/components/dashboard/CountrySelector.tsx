import { useGetCountriesQuery } from '@/utils/__generated__/graphql';
import { Listbox, Transition } from '@headlessui/react';
import { CheckIcon, SelectorIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import { Fragment } from 'react';

type CountrySelectorProps = {
  value: string;
  onChange: (value: string) => void;
};

export function CountrySelector({ value, onChange }: CountrySelectorProps) {
  const { data, error } = useGetCountriesQuery();

  if (error) {
    throw error;
  }

  return (
    <Listbox value={value} onChange={onChange}>
      {({ open }) => (
        <div className=" relative">
          <Listbox.Button className="relative w-full rounded-md border border-gray-300 bg-white px-2 py-2 text-left font-display text-sm">
            <span className="block truncate">
              {value.length < 3
                ? data?.countries.filter((a) => a.code === value)[0].name
                : value}
            </span>
            <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
              <SelectorIcon
                className="h-5 w-5 text-gray-400"
                aria-hidden="true"
              />
            </span>
          </Listbox.Button>

          <Transition
            show={open}
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options className="absolute z-20 mt-1 max-h-60 min-h-full w-full overflow-auto rounded-md bg-white py-1 text-base shadow-lg ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm">
              {data?.countries.map((country) => (
                <Listbox.Option
                  key={country.code}
                  className={({ active }) =>
                    clsx(
                      active ? 'bg-indigo-600 text-white' : 'text-gray-900',
                      'relative cursor-default select-none py-2 pl-3 pr-9',
                    )
                  }
                  value={country.code}
                >
                  {({ selected, active }) => (
                    <>
                      <span
                        className={clsx(
                          selected ? 'font-semibold' : 'font-normal',
                          'block truncate font-display',
                        )}
                      >
                        {country.name}
                      </span>

                      {selected ? (
                        <span
                          className={clsx(
                            active ? 'text-white' : 'text-indigo-600',
                            'absolute inset-y-0 right-0 flex items-center pr-4',
                          )}
                        >
                          <CheckIcon className="h-5 w-5" aria-hidden="true" />
                        </span>
                      ) : null}
                    </>
                  )}
                </Listbox.Option>
              ))}
            </Listbox.Options>
          </Transition>
        </div>
      )}
    </Listbox>
  );
}

export default CountrySelector;
