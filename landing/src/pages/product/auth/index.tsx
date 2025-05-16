import { AuthHeroSection } from '@/components/auth/AuthHeroSection'
import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductSection } from '@/components/product/ProductSection'
import Image from 'next/image'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  signUp: `
await nhost.auth.signUp({
  email: 'joe@example.com',
  password: 'secret-password'
})
`,
  signIn: `
await nhost.auth.signIn({
  email: 'joe@example.com',
  password: 'secret-password'
})
`,
  resetPassword: `
await nhost.auth.resetPassword({
  email: 'joe@example.com'
})
`,
  oauthSignIn: `
await nhost.auth.signIn({
  provider: 'google'
})
`,
}

export default function AuthPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('signUp')

  return (
    <>
      <AuthHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row gap-8">
          <div className="gradient-background mb-2 justify-self-center rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Simple to Implement
            </p>
          </div>

          <SectionHeading
            title="Authentication in minutes, not weeks"
            subtitle="Production-ready authentication for web and mobile apps. Focus on your product, not reinventing auth flows."
            className="max-w-xl"
            slotProps={{
              subtitle: {
                className: 'max-w-lg mx-auto',
              },
            }}
          />
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language="typescript"
              customStyle={{ minHeight: 220 }}
              slotProps={{
                root: { className: 'mx-auto md:max-w-xl shadow-lg' },
              }}
            >
              {codeSnippets[selectedExample].trim()}
            </CodeSnippet>

            <div className="mx-auto mt-6 grid max-w-xl grid-cols-1 gap-4 md:grid-cols-2">
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">
                  Multiple authentication methods
                </h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Support for email/password, social logins, passwordless,
                  WebAuthn, and more.
                </p>
              </div>
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">Role-based access control</h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Built-in authorization - define user roles and permissions
                  with granularity.
                </p>
              </div>
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">
                  Integration with other services
                </h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Seamlessly integrates with other Nhost services like Storage
                  and Database.
                </p>
              </div>
              <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
                <h3 className="text-sm font-bold">Session management</h3>
                <p className="mt-1 text-xs text-white text-opacity-65">
                  Handle user sessions securely with JWTs.
                </p>
              </div>
            </div>
          </div>

          <div className="relative order-1 w-full max-w-3xl xl:order-2">
            <div className="relative z-10 grid grid-flow-col justify-around xl:justify-evenly">
              <ExampleSelectorButton
                active={selectedExample === 'signUp'}
                onClick={() => setSelectedExample('signUp')}
              >
                Sign Up
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'signIn'}
                onClick={() => setSelectedExample('signIn')}
              >
                Sign In
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'resetPassword'}
                onClick={() => setSelectedExample('resetPassword')}
              >
                Reset Password
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'oauthSignIn'}
                onClick={() => setSelectedExample('oauthSignIn')}
              >
                OAuth Sign In
              </ExampleSelectorButton>
            </div>

            <Image
              src="/common/connectors/auth-example-connectors.svg"
              alt="Dashed lines"
              width={608}
              height={97}
              className="h-auto w-full"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full animate-pulse object-none xl:block"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row gap-8">
          <div className="gradient-background mb-2 justify-self-center rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">Full Control</p>
          </div>

          <SectionHeading
            title="Your users, your data"
            subtitle="Users are stored in your database. No data lock-in, full control over your user information."
            className="max-w-2xl"
            slotProps={{
              subtitle: {
                className: 'max-w-lg mx-auto',
              },
            }}
          />
        </div>

        <div className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper shadow-lg">
          <video autoPlay loop muted controls className="rounded-lg">
            <source src={`/videos/auth/auth.mp4`} type="video/mp4" />
          </video>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Full GraphQL integration</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              User data is accessible through the same GraphQL API as the rest
              of your data.
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Enhanced security</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Protect user data with industry-standard protocols.
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Self-hostable</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              As a 100% open-source solution, you can self-host Nhost and
              maintain complete control over your user data.
            </p>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row gap-8">
          <div className="gradient-background mb-2 justify-self-center rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              Enterprise-Grade Security
            </p>
          </div>

          <SectionHeading
            title="Powerful permissions, made simple"
            subtitle="Control what users are allowed to do for all CRUD operations using row and column level permissions."
            className="max-w-2xl"
            slotProps={{
              subtitle: {
                className: 'max-w-lg mx-auto',
              },
            }}
          />
        </div>

        <div className="mx-auto mt-16 flex w-full max-w-5xl items-center justify-center rounded-xl border border-divider bg-paper shadow-lg">
          <video autoPlay loop muted controls className="rounded-lg">
            <source src={`/videos/graphql/permissions.mp4`} type="video/mp4" />
          </video>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-2">
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Row-level security</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Restrict access to data based on user identity. Ensure users only
              see their own data or data specifically shared with them.
            </p>
          </div>
          <div className="rounded-md border border-divider bg-paper bg-opacity-50 p-4">
            <h3 className="text-sm font-bold">Column-level security</h3>
            <p className="mt-1 text-xs text-white text-opacity-65">
              Hide sensitive fields from certain users. Protect personal
              information while still allowing access to other data.
            </p>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="grid grid-flow-row gap-8">
          <div className="gradient-background mb-2 justify-self-center rounded-full p-px">
            <p className="rounded-full bg-paper px-4.5 py-1.5">
              More Capabilities
            </p>
          </div>

          <SectionHeading
            title="Advanced authentication features"
            subtitle="Everything you need for modern, secure authentication across all your platforms."
            className="max-w-2xl"
          />
        </div>

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-15">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-y-1/2 -translate-x-1/2" />
              <Glow className="animate-pulse" />
              <Image
                src="/common/logo-circle.svg"
                width={100}
                height={100}
                alt="Nhost Logo in a dark circle"
                className="relative z-10 h-26 w-26"
              />
            </div>

            <SectionHeading
              title="Nhost"
              subtitle="Build secure apps users trust"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io" className="mt-6">
              Start building <ArrowRightIcon />
            </Button>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/key.svg"
              width={24}
              height={24}
              alt="A key"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                Multi-Factor Authentication
              </h3>

              <p className="text-base text-white text-opacity-65">
                Boost security with MFA. Protect user accounts with an
                additional layer of verification beyond just passwords.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-7">
            <Image
              src="/products/social-providers.svg"
              width={116}
              height={40}
              alt="Twitter, GitHub, Discord, Google and Facebook logo"
              className="mx-auto"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Social Providers</h3>

              <p className="text-base text-white text-opacity-65">
                Simplify sign-up with social logins. Increase conversion rates
                by removing friction from your authentication flow.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8">
            <Image
              src="/products/secure.svg"
              width={24}
              height={24}
              alt="A shield"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">WebAuthn Integration</h3>

              <p className="text-base text-white text-opacity-65">
                Enable passwordless login with fingerprints, face recognition,
                or security keys. Modern security that users love.
              </p>
            </div>
          </Card>

          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center shadow-lg transition-all duration-300 hover:shadow-xl sm:row-span-8 lg:row-span-7">
            <Image
              src="/products/bulls-eye.svg"
              width={24}
              height={24}
              alt="Three circles"
              className="mx-auto"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Enterprise SSO</h3>

              <p className="text-base text-white text-opacity-65">
                Attract enterprise customers with Single Sign-On. Integrate with
                corporate identity providers through our WorkOS integration.
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-8">
            <div className="gradient-background rounded-full p-px">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                Complete Backend Platform
              </p>
            </div>

            <SectionHeading
              title="Explore the Nhost ecosystem"
              subtitle="Auth is just one part of our complete backend platform. Discover how all our services work together to power your applications."
            />
          </div>
        }
        disabledLink="auth"
      />

      <CTASection />
    </>
  )
}

AuthPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
