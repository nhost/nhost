import { Button } from '@/components/Button'
import { Container, ContainerProps } from '@/components/Container'
import { Link } from '@/components/Link'
import Image from 'next/image'
import { twMerge } from 'tailwind-merge'

export interface HeaderProps extends ContainerProps {}

export default function Header({ className, ...props }: HeaderProps) {
  return (
    <Container
      component="header"
      className={twMerge(
        'grid h-16 grid-flow-col items-center justify-between border-b border-white border-opacity-5',
        className,
      )}
      {...props}
    >
      <Link href="/">
        <Image
          src="/logo.svg"
          width={71}
          height={24}
          alt="Nhost Logo"
          priority
        />
      </Link>

      <nav aria-label="Main navigation">
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

      <div className="grid grid-flow-col gap-4">
        <Button
          href="https://app.nhost.io/sign-in"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
          variant="borderless"
        >
          Sign in
        </Button>

        <Button
          href="https://app.nhost.io/sign-up"
          target="_blank"
          rel="noopener noreferrer"
          size="small"
        >
          Sign up
        </Button>
      </div>
    </Container>
  )
}
