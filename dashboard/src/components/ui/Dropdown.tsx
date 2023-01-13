import { Menu, Transition } from '@headlessui/react';
import { ChevronDownIcon } from '@heroicons/react/solid';
import type { ReactNode } from 'react';
import { Fragment } from 'react';
import { Button } from './Button';

interface DropdownProps {
  text?: string;
  children?: ReactNode | ReactNode[];
  transparent?: boolean;
}

/**
 * @deprecated Use `@/ui/v2/Dropdown` instead.
 */
export function Dropdown({
  children,
  text = 'Project Options',
  transparent = false,
}: DropdownProps) {
  return (
    <div className="self-center font-display">
      <Menu as="div" className="relative z-10 inline-block text-left">
        <Menu.Button className="relative">
          <div>
            <Button
              Component="div"
              type={null}
              variant="secondary"
              transparent={transparent}
            >
              {text}
              <ChevronDownIcon
                className="align-items-center ml-1 -mr-1 h-5 w-5 self-center align-middle"
                aria-hidden="true"
              />
            </Button>
          </div>
        </Menu.Button>
        <Transition
          as={Fragment}
          enter="transition ease-out duration-100"
          enterFrom="transform opacity-0 scale-95"
          enterTo="transform opacity-100 scale-100"
          leave="transition ease-in duration-75"
          leaveFrom="transform opacity-100 scale-100"
          leaveTo="transform opacity-0 scale-95"
        >
          <Menu.Items className="box-drop absolute right-0 z-50 mt-2 w-form origin-top-right divide-y rounded-md border bg-white shadow-xl ring-black ring-opacity-50">
            {children}
          </Menu.Items>
        </Transition>
      </Menu>
    </div>
  );
}

export default Dropdown;
