import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { Link } from '@/components/common/Link'
import { SectionHeading } from '@/components/common/SectionHeading'
import { CheckmarkCircleIcon } from '@/components/common/icons/CheckmarkCircleIcon'

import { PricingFeature } from '@/components/pricing/PricingFeature'
import { Tooltip } from '@/components/common/Tooltip'
import { ReactElement, ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { XIcon } from '@/components/common/icons/XIcon'

function PricingListItem({
  title,
  titleTooltip,
  starterContent,
  proContent,
  teamContent,
  enterpriseContent,
  starterIcon,
  proIcon,
  teamIcon,
  enterpriseIcon,
  starterTooltip,
  proTooltip,
  teamTooltip,
  enterpriseTooltip,
}: {
  title: ReactNode
  titleTooltip?: string
  starterContent?: ReactNode
  proContent?: ReactNode
  teamContent?: ReactNode
  enterpriseContent?: ReactNode
  starterIcon?: 'check' | 'x'
  proIcon?: 'check' | 'x'
  teamIcon?: 'check' | 'x'
  enterpriseIcon?: 'check' | 'x'
  starterTooltip?: string
  proTooltip?: string
  teamTooltip?: string
  enterpriseTooltip?: string
}) {
  return (
    <li className="grid auto-cols-fr grid-flow-col gap-6 py-4">
      <div className="col-span-5 flex text-white text-opacity-65">
        <span className="pr-2">{title}</span>
        {titleTooltip && <Tooltip message={titleTooltip} />}
      </div>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !starterIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {starterIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {starterIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!starterIcon && starterContent}
        {starterTooltip && <Tooltip message={starterTooltip} />}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !proIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {proIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {proIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!proIcon && proContent}
        {proTooltip && <Tooltip message={proTooltip} />}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !teamIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {teamIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {teamIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!teamIcon && teamContent}
        {teamTooltip && <Tooltip message={teamTooltip} />}
      </span>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !enterpriseIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {enterpriseIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {enterpriseIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!enterpriseIcon && enterpriseContent}
        {enterpriseTooltip && <Tooltip message={enterpriseTooltip} />}
      </span>
    </li>
  )
}

export default function PricingPage() {
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl pt-20 pb-4 lg:pt-28 lg:pb-12"
      >
        <LineGrid
          className="left-0 right-0 top-5 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />

        <SectionHeading
          title="Choose the right plan for your infrastructure"
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-5xl',
            },
          }}
          className="relative z-10 pb-8 lg:pb-16"
        />
      </Container>

      <Container className="grid w-full grid-flow-row grid-cols-1 justify-items-center gap-4 pb-8 lg:grid-cols-4">
        {/* Starter plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Starter</h2>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Get your idea off the ground for free.
            </h2>

            <div className="flex flex-col items-start">
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-4xl font-medium">$0</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month / project
                </h2>
              </div>
              <div className="p-1 text-xs">Limit of 1 project</div>
            </div>
          </div>

          <PricingFeature
            subFeatures={[
              {
                title: 'Project pauses with inactivity',
              },
              {
                title: '1 GB database',
              },
              {
                title: '1 GB storage',
              },
              {
                title: '5 GB egress',
              },
              {
                title: 'Functions',
              },
              {
                title: 'Realtime APIs',
              },
              {
                title: 'IaC',
              },
              {
                title: 'Automated deployments',
              },
              {
                title: 'Unlimited users',
              },
              {
                title: 'OAuth providers',
              },
              {
                title: 'Community support',
              },
            ]}
          />

          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
        </div>

        {/* Pro plan */}
        <div className="flex w-full max-w-[500px] flex-col self-start rounded-md bg-brand-main p-1">
          <span className="px-8 py-4">Most Popular</span>
          <div className="space-y-8 overflow-hidden rounded-md border border-divider bg-black p-8">
            <div className="flex flex-col space-y-4 ">
              <div className="flex flex-row justify-between">
                <h2 className="font-mona text-2xl font-semibold">Pro</h2>
              </div>
              <h2 className="font-normal text-white text-opacity-65">
                Well suited for production applications, scale as needed.
              </h2>

              <div className="flex flex-col items-start">
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  From
                </h2>
                <div className="flex flex-row items-center space-x-2">
                  <h2 className="font-mona text-4xl font-medium">$25</h2>
                  <h2 className="mt-1 font-normal text-white text-opacity-65">
                    / month / project
                  </h2>
                </div>
              </div>
            </div>

            <h2 className="font-sm mt-1 text-white text-opacity-65">
              Everything in Starter plus:
            </h2>

            <PricingFeature
              subFeatures={[
                {
                  title: 'No project pausing',
                },
                {
                  title: '10 GB database',
                },
                {
                  title: '50 GB storage',
                },
                {
                  title: '50 GB egress',
                },
                {
                  title: 'Automated backups',
                },
                {
                  title: 'AI toolkit',
                },
                {
                  title: 'Run your own services',
                },
                {
                  title: 'Managed Grafana',
                },
                {
                  title: 'Email support',
                },
              ]}
            />

            <Button
              className="w-full justify-center text-center"
              href="https://app.nhost.io/new"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get Started <ArrowRightIcon />
            </Button>
          </div>
        </div>

        {/* Teams plan  */}
        <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
          <div className="flex flex-col space-y-4 ">
            <div className="flex flex-row justify-between">
              <h2 className="font-mona text-2xl font-semibold">Team</h2>
              <span className="rounded-md bg-brand-main px-2 py-2">New</span>
            </div>

            <h2 className="font-normal text-white text-opacity-65">
              Collaborate with added support, scale as needed.
            </h2>

            <div className="flex flex-col items-start">
              <h2 className="mt-1 font-normal text-white text-opacity-65">
                From
              </h2>
              <div className="flex flex-row items-center space-x-2">
                <h2 className="font-mona text-4xl font-medium">$599</h2>
                <h2 className="mt-1 font-normal text-white text-opacity-65">
                  / month / project
                </h2>
              </div>
            </div>
          </div>

          <h2 className="font-sm mt-1 text-white text-opacity-65">
            Everything in Pro plus:
          </h2>

          <PricingFeature
            subFeatures={[
              {
                title: 'Email support SLA',
              },
              {
                title: 'Dedicated discord channel',
              },
              {
                title: 'Connect to external databases',
              },
              {
                title: 'Advanced GraphQL features',
              },
              {
                title: 'SOC2 (coming soon)',
              },
            ]}
          />

          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
            className="col-span-2 w-full justify-center text-center"
          >
            Get Started <ArrowRightIcon />
          </Button>
        </div>

        {/* Enterprise plan */}
        <div className="w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8 md:mt-14">
          <div className="flex flex-col space-y-4 ">
            <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

            <h2 className="font-normal text-white text-opacity-65">
              Ideal for specific infrastructure and customization needs.
            </h2>

            <div className="flex flex-row items-center space-x-2">
              <h2 className="font-mona text-4xl font-medium">Contact us</h2>
            </div>
          </div>

          <h2 className="font-sm mt-1 text-white text-opacity-65">
            Everything in Team plus:
          </h2>

          <PricingFeature
            subFeatures={[
              { title: 'SLAs' },
              { title: 'Dedicated technical account manager' },
              { title: 'Dedicated clusters (add-on)' },
            ]}
          />

          <Button
            className="w-full justify-center text-center"
            href="mailto:hello@nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Contact us <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <Container
        slotProps={{
          root: {
            className: 'sticky top-0 bg-black hidden md:block transform-cpu',
          },
        }}
        className="relative grid auto-cols-fr grid-flow-col content-start gap-6 pt-20 pb-4"
      >
        <div className="col-span-5" />

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Starter"
            subtitle="Free forever"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            href="https://app.nhost.io/new"
            rel="noopener noreferrer"
            target="_blank"
          >
            Start for free <ArrowRightIcon />
          </Button>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Pro"
            subtitle="$25/mo"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            variant="borderless"
            className="justify-center text-center"
            href="https://app.nhost.io/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Started
          </Button>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Team"
            subtitle="$599/mo"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            variant="borderless"
            className="justify-center text-center"
            href="https://app.nhost.io/new"
            target="_blank"
            rel="noopener noreferrer"
          >
            Get Started
          </Button>
        </div>

        <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
          <SectionHeading
            title="Enterprise"
            subtitle="Custom"
            className="gap-2"
            slotProps={{
              title: { className: 'text-3xl md:text-3xl' },
              subtitle: { className: 'text-base' },
            }}
          />

          <Button
            variant="borderless"
            href="mailto:hello@nhost.io"
            className="justify-center"
          >
            Contact Us
          </Button>
        </div>
      </Container>

      <Container className="grid auto-rows-auto items-start gap-8 pb-28">
        <section className="mt-4">
          <h3 className="py-4 text-xl">Database</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Dedicated Postgres instance"
              starterIcon="check"
              teamIcon="check"
              proIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Database size"
              starterContent="1 GB"
              proContent="10 GB included, then $0.20 per GB"
              teamContent="10 GB included, then $0.20 per GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Automated Backups"
              titleTooltip="Daily backups of your database that can be restored."
              starterIcon="x"
              proContent="7 days of backups"
              teamContent="7 days of backups"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Hasura GraphQL</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Hasura GraphQL Engine"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Realtime subscriptions"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Event triggers"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Role based authorization"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Advanced GraphQL features"
              titleTooltip="Observability metrics include request rate, duration, and failure rate, alongside security features such as disabling the admin secret and limiting query depth."
              starterIcon="x"
              proIcon="x"
              teamIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Authentication</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Total users"
              starterContent="Unlimited"
              proContent="Unlimited"
              teamContent="Unlimited"
              enterpriseContent="Unlimited"
            />

            <PricingListItem
              title="Social OAuth providers"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="WebAuthn / FIDO2"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Email / Password"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Magic Link"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="2FA"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom SMTP"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom emails"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Advanced security features"
              enterpriseContent="Contact Us"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Storage</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Storage size"
              starterContent="1 GB included"
              proContent="50 GB included, then $0.05 per GB"
              teamContent="50 GB included, then $0.05 per GB"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Custom permissions"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Image transformation"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Global CDN"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Functions</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Total functions"
              starterContent="10 included"
              proContent="50 included, then $5 per 50"
              teamContent="50 included, then $5 per 50"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Execution"
              starterContent="1 GB-hours included"
              proContent="10 GB-hours included, then $0.18 per GB-hour (billed per second)"
              teamContent="10 GB-hours included, then $0.18 per GB-hour (billed per second)"
              enterpriseContent="Custom"
            />

            <PricingListItem
              title="Execution Time"
              starterContent="10 sec"
              proContent="60 sec"
              teamContent="10 min"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">AI Toolkit</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="pgvector"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Graphite"
              titleTooltip="Graphite is our AI service available to your project as an add-on. It is billed per vCPU core and memory allocated to the service. See Compute Pricing below."
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Auto-Embeddings"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Nhost Assistants"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Nhost Run</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Run your own services"
              titleTooltip="Nhost Run is a managed container runtime for running your own services. It is billed per vCPU core and memory allocated to the service. See Compute Pricing below."
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Private registry"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Network Egress</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Egress"
              starterContent="5 GB included"
              proContent="50 GB included, then $0.10 per GB"
              teamContent="50 GB included, then $0.10 per GB"
              enterpriseContent="Custom"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Collaboration</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="IaC"
              titleTooltip="Use the Nhost CLI and Nhost Config to manage your infrastructure as code."
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Deployments"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Projects"
              starterContent="1 project"
              proContent="Unlimited"
              teamContent="Unlimited"
              enterpriseContent="Unlimited"
            />

            <PricingListItem
              title="Workspace members"
              titleTooltip="Only workspace members have access to projects and can trigger deployments."
              starterContent="1 member"
              proContent="Unlimited"
              teamContent="Unlimited"
              enterpriseContent="Unlimited"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Platform</h3>
          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="HTTPS / SSL"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Compute resources"
              titleTooltip="CPU and memory allocated to services. See Compute Pricing below."
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Service replicas"
              titleTooltip="Service replicas are the number of instances of a service running. See Compute Pricing below."
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Custom domains"
              starterIcon="x"
              proContent="$10 per project / month"
              teamContent="$10 per project / month"
              enterpriseContent="$10 per project / month"
            />

            <PricingListItem
              title="External databases"
              titleTooltip="Connect to external databases hosted outside of Nhost."
              starterIcon="x"
              proIcon="x"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Auto scaling"
              starterIcon="x"
              proIcon="x"
              teamContent="Coming soon"
              enterpriseContent="Coming soon"
            />

            <PricingListItem
              title="99.9% SLA"
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Dedicated clusters"
              titleTooltip="A dedicated and fully managed cluster for your infrastructure. Ideal for security, customization, and compliance."
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseContent="Available as an add-on"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Observability</h3>
          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Nhost Logs"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Managed Grafana for metrics"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />
          </ul>
        </section>

        <section>
          <h3 className="py-4 text-xl">Support</h3>

          <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
            <PricingListItem
              title="Community"
              starterIcon="check"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Email"
              starterIcon="x"
              proIcon="check"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Email SLA"
              starterIcon="x"
              proIcon="x"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Dedicated Discord channel"
              starterIcon="x"
              proIcon="x"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Security questionnaire"
              starterIcon="x"
              proIcon="x"
              teamIcon="check"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Dedicated technical account manager"
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="24x7x365 support with SLA"
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="Architecture review"
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseIcon="check"
            />

            <PricingListItem
              title="On boarding"
              starterIcon="x"
              proIcon="x"
              teamIcon="x"
              enterpriseIcon="check"
            />
          </ul>
        </section>
      </Container>

      <section className="col-span-3 mx-auto mt-4 grid max-w-5xl grid-flow-row gap-6">
        <SectionHeading
          title="Compute Pricing"
          subtitle="Billed by the minute"
        />

        <div className="bg-background inline-flex shrink grow basis-0 flex-col items-center justify-start gap-4 rounded-lg border border-black border-opacity-5 pb-16">
          <div className="flex flex-col items-center justify-start gap-[12px] p-[0px]">
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="inline-flex items-center justify-center gap-[4px] p-[0px]">
                {/* <div className="text-center text-[24px] font-medium leading-loose text-zinc-500">
                  $
                </div> */}
                {/* <div className="text-[48px] font-semibold leading-10 text-zinc-500"> */}
                <h2 className="font-mona text-2xl font-semibold">$</h2>
                <h2 className="font-mona text-2xl font-semibold">50</h2>
              </div>
              <div className="text-[16px] font-normal leading-snug text-gray-300">
                Per vCPU core / month
              </div>
              <div className="text-[14px] font-normal leading-snug text-gray-300 text-opacity-50">
                For each vCPU core you get 2 GB of memory.
              </div>
            </div>
          </div>
          <div className="flex h-[38px] flex-col items-center justify-start gap-4 self-stretch p-[0px]">
            <div className="inline-flex h-[1px] w-[270px] items-center justify-center p-[0px]">
              <div className="h-[1px] w-[270px] bg-black bg-opacity-5 dark:bg-gray-100"></div>
            </div>
            <div className="text-[14px] font-normal leading-tight text-gray-500">
              $0.0012 / vCPU / minute
            </div>
          </div>
        </div>
      </section>

      <section className="col-span-3 mx-auto mt-4 grid max-w-5xl grid-flow-row gap-16 p-8">
        <SectionHeading
          title="FAQ"
          subtitle={
            <>
              Didn&apos;t find what you&apos;re looking for?{' '}
              <Link
                href="mailto:hello@nhost.io"
                className="text-white text-opacity-100"
              >
                Contact Us
              </Link>
              .
            </>
          }
        />

        <ul className="divide-y divide-divider">
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Are plans per project?</h3>

            <p className="text-base">Yes, plans are per project.</p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">
              How many free projects can I have?
            </h3>

            <p className="text-base">You can have as many free projects as you want, as long as only 1 is active at any given time. You can pause and unpause free projects as needed.</p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Can I switch between plans later?</h3>

            <p className="text-base">
              Yes, you can upgrade plans at any time. To downgrade, please
              contact us at{' '}
              <Link
                href="mailto:support@nhost.io"
                className="text-opacity-100 underline"
              >
                support@nhost.io
              </Link>
              .
            </p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">Can I export my data?</h3>

            <p className="text-base">
              Yes, you have full access to your database and storage. No vendor
              lock-in.
            </p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">What happens if I exceed the limits?</h3>

            <p className="text-base">We never stop your project and you will be charged for the excess usage. Pay as you grow.</p>
          </li>
        </ul>
      </section>
    </>
  )
}

PricingPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
