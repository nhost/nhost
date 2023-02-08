import Image from 'next/image'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import HoverPopover from '../HoverPopover/HoverPopover'
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
          className="absolute left-1/2 mx-auto hidden -translate-x-1/2 lg:block"
        >
          <ul className="grid grid-flow-col items-center gap-4 font-medium">
            <li>
              <HoverPopover title="Product">
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
              </HoverPopover>
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
