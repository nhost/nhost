import Image from 'next/image'
import Link from 'next/link'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'

export interface HeaderProps extends ContainerProps {}

export default function Header({ className, ...props }: HeaderProps) {
  return (
    <Container
      component="header"
      className={twMerge(
        'grid grid-flow-col items-center justify-between border-b border-white border-opacity-10 py-5',
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

      <nav>
        <ul className="grid grid-flow-col gap-6 text-sm font-medium">
          <li>Product</li>
          <li>Pricing</li>
          <li>Blog</li>
          <li>About</li>
          <li>Changelog</li>
          <li>Customers</li>
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
