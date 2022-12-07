import { Text } from '@/ui/Text';
import { Listbox, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/solid';
import clsx from 'clsx';
import Image from 'next/image';
import type { ReactNode } from 'react';
import { Fragment } from 'react';

export type SelectorOption = {
  id: string;
  name: string;
  disabled: boolean;
  [key: string | number]: any;
};

type SelectorProps = {
  options?: SelectorOption[];
  value: SelectorOption;
  onChange: (SelectorOption: any) => void;
  Selected?: any;
  children?: ReactNode[] | ReactNode;
  OptionsSelector?: any;
  width?: string;
  border?: boolean;
  optionsWidth?: string;
};

function SelectedAbstract({ current }: any) {
  return (
    <div className="grid grid-flow-col gap-2 self-center">
      <Text size="normal">{current.name}</Text>
    </div>
  );
}

export function SelectedRegions({ current }: any) {
  return (
    <div className="grid grid-flow-col items-center gap-2 self-center">
      <Image
        src={`/assets/${current.code}.svg`}
        alt={`${current.name} country flag`}
        width={20}
        height={20}
      />

      <Text className="self-center" size="normal" color="greyscaleDark">
        {current.name}
      </Text>
    </div>
  );
}

// @FIX: any
function SelectorAbstract({ selected, option }: any) {
  return (
    <div className="grid grid-flow-col gap-2 px-2">
      <span
        className={`${
          selected ? 'font-medium' : 'font-normal'
        } block cursor-pointer self-center truncate`}
      >
        {option.name}
      </span>
    </div>
  );
}

export function SelectorRegions({ option }: any) {
  const { country } = option;

  return (
    <div
      className={clsx(
        'flex flex-row place-content-between space-x-2 px-2 py-2',
        !option.active && 'cursor-not-allowed opacity-70',
      )}
    >
      <div className="flex items-center">
        <Image
          src={`/assets/${option.code}.svg`}
          alt={`${option.name} country flag`}
          width={28}
          height={28}
          className="object-fill"
        />

        <div className="ml-3 flex flex-col">
          <Text color="greyscaleDark" size="normal">
            {option.name}
          </Text>
          <Text color="greyscaleDark" size="tiny" className="font-normal">
            {country}
          </Text>
        </div>
      </div>
      {!option.active && (
        <div className="flex self-center">
          <Text color="greyscaleGrey" size="tiny" className="font-normal">
            Coming soon
          </Text>
        </div>
      )}
    </div>
  );
}
interface EachOptionSelectorProps {
  options: SelectorOption[];
  OptionsSelector: any;
  value?: SelectorOption;
}

export function EachOptionSelector({
  options,
  OptionsSelector,
  value,
}: EachOptionSelectorProps) {
  return (
    <>
      {options.map((option, optionIdx) => (
        <Listbox.Option
          disabled={option.disabled}
          key={option.id || optionIdx}
          className={({ active }) =>
            `${
              active
                ? 'cursor-pointer text-greyscaleDark'
                : 'text-greyscaleDark'
            } relative select-none self-center py-2 pr-4 font-medium`
          }
          value={option}
        >
          {({ selected, active }) => (
            <div>
              <OptionsSelector
                option={option}
                selected={selected}
                active={active}
                value={value || null}
              />
            </div>
          )}
        </Listbox.Option>
      ))}
    </>
  );
}

/**
 * @deprecated Use `@/ui/v2/Select` instead.
 */
export default function Selector({
  value,
  onChange,
  options,
  Selected = SelectedAbstract,
  children,
  OptionsSelector = SelectorAbstract,
  width = 'w-full',
  border = true,
  optionsWidth = 'w-full',
}: SelectorProps) {
  return (
    <div>
      <Listbox value={value} onChange={onChange}>
        <div className="relative">
          <Listbox.Button
            className={clsx(
              'flex  flex-row place-content-between rounded-md  bg-white px-2  py-2 text-left font-display font-normal text-dark focus:outline-none focus:ring-1 focus:ring-verydark  ',
              border && 'border border-input',
              width,
            )}
          >
            <Selected current={value} />
            <ChevronDownIcon
              className="align-items-center mr-[2px] h-4 w-4 cursor-pointer self-center align-middle"
              aria-hidden="true"
            />
          </Listbox.Button>
          <Transition
            as={Fragment}
            leave="transition ease-in duration-100"
            leaveFrom="opacity-100"
            leaveTo="opacity-0"
          >
            <Listbox.Options
              className={clsx(
                'absolute  z-50 cursor-default rounded-md border-gray-300  bg-white  py-1 text-base  shadow-xl ring-1 ring-black ring-opacity-5 focus:outline-none sm:text-sm',
                optionsWidth,
              )}
            >
              {children || (
                <EachOptionSelector
                  options={options}
                  OptionsSelector={OptionsSelector}
                  value={value}
                />
              )}
            </Listbox.Options>
          </Transition>
        </div>
      </Listbox>
    </div>
  );
}
