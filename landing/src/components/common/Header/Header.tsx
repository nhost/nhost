import { Popover, Transition } from '@headlessui/react'
import Image from 'next/image'
import { Fragment, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { ChevronDownIcon } from '../icons/ChevronDownIcon'
import { ChevronUpIcon } from '../icons/ChevronUpIcon'
import { MenuIcon } from '../icons/MenuIcon'
import { XIcon } from '../icons/XIcon'
import { Link } from '../Link'
import { MobileMenu } from '../MobileMenu'

export interface HeaderProps extends ContainerProps {}

export default function Header({
  className,
  slotProps,
  ...props
}: HeaderProps) {
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)

  useEffect(() => {
    if (mobileMenuVisible) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'auto'
    }
  }, [mobileMenuVisible])

  return (
    <>
      {mobileMenuVisible && (
        <MobileMenu onLinkClick={() => setMobileMenuVisible(false)} />
      )}

      <Container
        component="header"
        slotProps={{
          ...(slotProps || {}),
          root: {
            className: twMerge(
              'z-40 bg-black overflow-visible',
              !mobileMenuVisible && 'backdrop-blur-md bg-opacity-[1%]',
              slotProps?.root?.className,
            ),
          },
        }}
        className={twMerge(
          'grid h-16 grid-flow-col items-center justify-between border-b border-white border-opacity-5 backdrop-blur',
          className,
        )}
        {...props}
      >
        <Link href="/" onClick={() => setMobileMenuVisible(false)}>
          <Image
            src="/common/logo.svg"
            width={71}
            height={24}
            alt="Nhost Logo"
            priority
          />
        </Link>

        <nav aria-label="Main navigation" className="hidden lg:block">
          <ul className="grid grid-flow-col items-center gap-4 font-medium">
            <li>
              <Popover>
                {({ open, close }) => (
                  <>
                    <Popover.Button className="grid grid-flow-col items-center gap-2 p-1.5 text-white text-opacity-65 hover:underline active:outline-none">
                      Product{' '}
                      {open ? (
                        <ChevronUpIcon className="h-4 w-4" />
                      ) : (
                        <ChevronDownIcon className="h-4 w-4" />
                      )}
                    </Popover.Button>
                    <Transition
                      as={Fragment}
                      enter="transition ease-out duration-200"
                      enterFrom="opacity-0 translate-y-1"
                      enterTo="opacity-100 translate-y-0"
                      leave="transition ease-in duration-150"
                      leaveFrom="opacity-100 translate-y-0"
                      leaveTo="opacity-0 translate-y-1"
                    >
                      <Popover.Panel className="absolute z-50 mt-3 w-52 transform rounded-md border border-white border-opacity-10 bg-black p-4">
                        <nav aria-label="Secondary navigation">
                          <ul className="grid grid-flow-row gap-2">
                            <li>
                              <Button
                                href="/product/database"
                                variant="borderless"
                                size="xs"
                                className="w-full text-opacity-65"
                                onClick={close}
                              >
                                Database
                              </Button>
                            </li>
                            <li className="h-px w-full bg-white bg-opacity-10" />
                            <li>
                              <Button
                                href="/product/graphql"
                                variant="borderless"
                                size="xs"
                                className="w-full text-opacity-65"
                                onClick={close}
                              >
                                GraphQL API
                              </Button>
                            </li>
                            <li className="h-px w-full bg-white bg-opacity-10" />
                            <li>
                              <Button
                                href="/product/auth"
                                variant="borderless"
                                size="xs"
                                className="w-full text-opacity-65"
                                onClick={close}
                              >
                                Auth
                              </Button>
                            </li>
                            <li className="h-px w-full bg-white bg-opacity-10" />
                            <li>
                              <Button
                                href="/product/storage"
                                variant="borderless"
                                size="xs"
                                className="w-full text-opacity-65"
                                onClick={close}
                              >
                                Storage
                              </Button>
                            </li>
                            <li className="h-px w-full bg-white bg-opacity-10" />
                            <li>
                              <Button
                                href="/product/functions"
                                variant="borderless"
                                size="xs"
                                className="w-full text-opacity-65"
                                onClick={close}
                              >
                                Functions
                              </Button>
                            </li>
                          </ul>
                        </nav>
                      </Popover.Panel>
                    </Transition>
                  </>
                )}
              </Popover>
            </li>
            <li>
              <Link href="https://docs.nhost.io" className="p-1.5">
                Docs
              </Link>
            </li>
            <li>
              <Link href="/blog" className="p-1.5">
                Blog
              </Link>
            </li>
            <li>
              <Link href="/about" className="p-1.5">
                About
              </Link>
            </li>
            <li>
              <Link href="/changelog" className="p-1.5">
                Changelog
              </Link>
            </li>
            <li>
              <Link href="/customers" className="p-1.5">
                Customers
              </Link>
            </li>
            <li>
              <Link href="/pricing" className="p-1.5">
                Pricing
              </Link>
            </li>
          </ul>
        </nav>

        <div className="hidden grid-flow-col gap-4 lg:grid">
          <Button
            href="https://app.nhost.io/signin"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="borderless"
          >
            Sign in
          </Button>

          <Button
            href="https://app.nhost.io/signup"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            Sign up
          </Button>
        </div>

        <div className="block lg:hidden">
          <Button
            variant="borderless"
            className="bg-transparent p-2"
            aria-label={mobileMenuVisible ? 'Close Menu' : 'Open Menu'}
            onClick={() => setMobileMenuVisible((current) => !current)}
          >
            {mobileMenuVisible ? <XIcon /> : <MenuIcon />}
          </Button>
        </div>
      </Container>
    </>
  )
}
