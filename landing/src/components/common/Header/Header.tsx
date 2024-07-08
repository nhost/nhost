import { Transition } from '@headlessui/react'
import Image from 'next/image'
import { Fragment, useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { Link } from '../Link'
import { MobileMenu } from '../MobileMenu'
import { ProductPopover } from '../ProductPopover'
import { MenuIcon } from '../icons/MenuIcon'
import { XIcon } from '../icons/XIcon'

export interface HeaderProps extends ContainerProps {}

export default function Header({
  className,
  slotProps,
  ...props
}: HeaderProps) {
  const [mobileMenuVisible, setMobileMenuVisible] = useState(false)

  useEffect(() => {
    if (mobileMenuVisible) {
      document.body.style.overflowY = 'hidden'
    } else {
      document.body.style.overflowY = 'visible'
    }
  }, [mobileMenuVisible])

  const [stargazersCount, setStargazersCount] = useState<string>('7K')

  useEffect(() => {
    const fetchStargazersCount = async () => {
      try {
        const res = await fetch('https://api.github.com/repos/nhost/nhost')
        if (!res.ok) {
          throw new Error(`HTTP error: Status ${res.status}`)
        }
        const data = await res.json()

        const newStargazersCount = data?.stargazers_count

        if (!newStargazersCount) {
          return
        }

        const formatter = Intl.NumberFormat('en', {
          notation: 'compact',
          compactDisplay: 'short',
        })

        const stargazersCountFormatted = formatter.format(newStargazersCount)

        setStargazersCount(stargazersCountFormatted)
      } catch (error) {
        console.error(error)
      }
    }

    fetchStargazersCount()
  }, [])

  return (
    <>
      <Transition
        show={mobileMenuVisible}
        as={Fragment}
        enter="transition ease-out duration-200"
        enterFrom="opacity-0 translate-y-1"
        enterTo="opacity-100 translate-y-0"
        leave="transition ease-in duration-150"
        leaveFrom="opacity-100 translate-y-0"
        leaveTo="opacity-0 translate-y-1"
      >
        <MobileMenu onLinkClick={() => setMobileMenuVisible(false)} />
      </Transition>

      <Container
        component="header"
        slotProps={{
          ...(slotProps || {}),
          root: {
            className: twMerge(
              'z-40 bg-black overflow-visible motion-safe:transition-all',
              !mobileMenuVisible && 'backdrop-blur-sm bg-opacity-[50%]',
              slotProps?.root?.className,
            ),
          },
        }}
        className={twMerge(
          'grid h-16 grid-flow-col items-center justify-between border-b border-white border-opacity-7 backdrop-blur',
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

        <nav
          aria-label="Main navigation"
          className="absolute left-1/2 mx-auto hidden h-full -translate-x-1/2 items-center lg:flex"
        >
          <ul className="grid grid-flow-col items-center gap-4 font-medium">
            <li>
              <ProductPopover />
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

        <div className="hidden justify-between lg:flex">
          <a
            className="flex flex-row items-center justify-center rounded px-2.5 py-1.5 font-medium leading-snug opacity-50 transition-all duration-200 ease-in-out hover:opacity-100"
            href="https://github.com/nhost/nhost"
            target="_blank"
            rel="noreferrer"
          >
            <Image
              className="mr-2"
              src="/images/github-mark-white.svg"
              width={22}
              height={22}
              alt="Nhost on GitHub"
            />
            <span className="truncate">{stargazersCount}</span>
          </a>

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
