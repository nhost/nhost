import Image from 'next/image'
import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
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
              'z-50 bg-black',
              !mobileMenuVisible && 'backdrop-blur bg-opacity-[1%]',
              slotProps?.root?.className,
            ),
          },
        }}
        className={twMerge(
          'grid h-16 grid-flow-col items-center justify-between border-b border-white border-opacity-5',
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

        <nav aria-label="Main navigation" className="hidden md:block">
          <ul className="grid grid-flow-col gap-6 font-medium">
            <li>Product</li>
            <li>
              <Link href="/pricing">Pricing</Link>
            </li>
            <li>
              <Link href="/blog">Blog</Link>
            </li>
            <li>
              <Link href="/about">About</Link>
            </li>
            <li>
              <Link href="/changelog">Changelog</Link>
            </li>
            <li>
              <Link href="/customers">Customers</Link>
            </li>
          </ul>
        </nav>

        <div className="hidden grid-flow-col gap-4 md:grid">
          <Button
            href="https://app.nhost.io/sign-in"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
            variant="borderless"
          >
            Sign in
          </Button>

          <Button
            href="https://app.nhost.io/sign-up"
            target="_blank"
            rel="noopener noreferrer"
            size="sm"
          >
            Sign up
          </Button>
        </div>

        <div className="block md:hidden">
          <Button
            variant="borderless"
            className="p-2"
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
