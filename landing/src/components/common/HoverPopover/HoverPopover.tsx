import { useOnClickOutside } from '@/hooks/useOnClickOutside'
import { Popover, Transition } from '@headlessui/react'
import {
  Fragment,
  KeyboardEvent,
  PropsWithChildren,
  useRef,
  useState,
} from 'react'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'

export default function HoverPopover({
  title,
  children,
}: PropsWithChildren<{ title: string }>) {
  const panelRef = useRef<HTMLDivElement>(null)
  const [open, setOpen] = useState(false)

  useOnClickOutside(panelRef, () => setOpen(false))

  return (
    <Popover
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <Popover.Button
        className="grid grid-flow-col items-center gap-2 p-1.5 text-white text-opacity-65 hover:underline focus:outline-none focus-visible:!rounded-sm focus-visible:!outline focus-visible:!outline-2 focus-visible:outline-blue-300 active:outline-none"
        onKeyDown={(event: KeyboardEvent) => {
          if (event.key !== 'Enter' && event.key !== 'Escape') {
            return
          }

          if (event.key === 'Escape') {
            setOpen(false)
            return
          }

          setOpen((prevOpen) => !prevOpen)
        }}
      >
        {title}{' '}
        {open ? (
          <ChevronUpIcon className="h-4 w-4" />
        ) : (
          <ChevronDownIcon className="h-4 w-4" />
        )}
      </Popover.Button>

      <Transition
        show={open}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <Popover.Panel ref={panelRef} className="absolute z-50 mt-0">
          <div
            className="mt-3 w-52 transform rounded-md border border-white border-opacity-10 bg-black p-4"
            onKeyDown={(event: KeyboardEvent) => {
              if (event.key !== 'Escape') {
                return
              }

              setOpen(false)
            }}
          >
            {children}
          </div>
        </Popover.Panel>
      </Transition>
    </Popover>
  )
}
