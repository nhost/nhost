import Image from 'next/image'
import { PropsWithChildren } from 'react'
import { Container } from '../Container'
import { Link } from '../Link'

function List({ children, title }: PropsWithChildren<{ title: string }>) {
  return (
    <div className="col-span-6 grid grid-flow-row place-content-start gap-3 lg:col-span-2">
      <h3>{title}</h3>
      <ul className="grid grid-flow-row gap-3">{children}</ul>
    </div>
  )
}

export default function Footer() {
  return (
    <Container
      component="footer"
      className="grid grid-cols-12 gap-y-12 gap-x-2"
      slotProps={{
        root: {
          className: 'py-14 border-t border-white border-opacity-7',
        },
      }}
    >
      <div className="col-span-12 grid grid-flow-col place-content-between lg:col-span-4 lg:grid-flow-row">
        <Image src="/common/logo.svg" width={71} height={24} alt="Nhost Logo" />

        <div className="grid grid-flow-col items-center justify-start gap-6 opacity-65">
          <Link
            href="https://github.com/nhost/nhost"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Image
              src="/brands/brand-github.svg"
              width={18}
              height={18}
              alt="GitHub Logo"
            />
          </Link>

          <Link
            href="https://twitter.com/nhost"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Image
              src="/brands/brand-x.svg"
              width={18}
              height={18}
              alt="Twitter Logo"
            />
          </Link>

          <Link
            href="https://discord.com/invite/9V7Qb2U"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Image
              src="/brands/brand-discord.svg"
              width={18}
              height={18}
              alt="Discord Logo"
            />
          </Link>

          <Link
            href="https://www.youtube.com/c/Nhost_io"
            target="_blank"
            rel="noreferrer noopener"
          >
            <Image
              src="/brands/brand-youtube.svg"
              width={18}
              height={18}
              alt="YouTube Logo"
            />
          </Link>
        </div>
      </div>

      <List title="Features">
        <li>
          <Link href="/product/database">Database</Link>
        </li>
        <li>
          <Link href="/product/graphql">GraphQL</Link>
        </li>
        <li>
          <Link href="/product/auth">Auth</Link>
        </li>
        <li>
          <Link href="/product/storage">Storage</Link>
        </li>
        <li>
          <Link href="/product/functions">Functions</Link>
        </li>
      </List>

      <List title="Product">
        <li>
          <Link href="/pricing">Pricing</Link>
        </li>
        <li>
          <Link href="/blog">Blog</Link>
        </li>
      </List>

      <List title="Company">
        <li>
          <Link href="/about">About</Link>
        </li>
        <li>
          <Link href="/customers">Customers</Link>
        </li>
      </List>

      <List title="Resources">
        <li>
          <Link
            href="https://docs.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Docs
          </Link>
        </li>

        <li>
          <Link
            href="https://status.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Status
          </Link>
        </li>
        <li>
          <Link href="/legal">Legal</Link>
        </li>
        <li>
          <Link href="/security">Security</Link>
        </li>
      </List>
    </Container>
  )
}
