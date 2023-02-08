import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { LineGrid } from '@/components/common/LineGrid'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `await nhost.auth.signUp({
  email: 'joe@example.com',
  password: 'secret-password'
})`

export default function AuthHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/authentication.svg"
            width={24}
            height={24}
            alt="A user"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title="Auth"
          subtitle="Everything you need to sign in and manage users."
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold',
            },
            subtitle: {
              className: 'text-base !leading-normal',
            },
          }}
        />
      </div>

      <div className="relative sm:pt-6 md:-translate-x-1 md:pt-24">
        <LineGrid className="md:-translate-x-11 md:-translate-y-11" priority />

        <Glow className="h-[75%] w-full opacity-40 blur-3xl" />

        <Image
          src="/products/auth-hero.png"
          alt="Auth page in the Nhost Dashboard"
          width={2880}
          height={1800}
          className="relative z-10 h-auto w-full"
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <CodeSnippet
          language="typescript"
          disableGlow
          disableLineGrid
          className="absolute -right-3 -bottom-6 z-20 max-w-sm shadow-lg xl:-right-5 xl:-bottom-12"
        >
          {heroExample}
        </CodeSnippet>
      </div>
    </Container>
  )
}
