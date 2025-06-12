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
import { ReactElement, ReactNode, useState } from 'react'
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

function SelfHostedPricingListItem({
  title,
  titleTooltip,
  ossContent,
  enterpriseContent,
  ossIcon,
  enterpriseIcon,
  ossTooltip,
  enterpriseTooltip,
}: {
  title: ReactNode
  titleTooltip?: string
  ossContent?: ReactNode
  enterpriseContent?: ReactNode
  ossIcon?: 'check' | 'x'
  enterpriseIcon?: 'check' | 'x'
  ossTooltip?: string
  enterpriseTooltip?: string
}) {
  return (
    <li className="grid grid-cols-11 gap-6 py-4">
      <div className="col-span-5 flex text-white text-opacity-65">
        <span className="pr-2">{title}</span>
        {titleTooltip && <Tooltip message={titleTooltip} />}
      </div>

      <span
        className={twMerge(
          'col-span-3 flex items-center justify-center text-center text-white',
          !ossIcon && 'text-opacity-65',
          'lg:inline',
        )}
      >
        {ossIcon === 'check' && (
          <CheckmarkCircleIcon className="mx-auto h-5 w-5" />
        )}
        {ossIcon === 'x' && <XIcon className="mx-auto h-5 w-5" />}
        {!ossIcon && ossContent}
        {ossTooltip && <Tooltip message={ossTooltip} />}
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

const PricingTabs = ({ onTabChange }: { onTabChange: (tab: string) => void }) => {
  const [activeTab, setActiveTab] = useState('cloud');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
    onTabChange(tab);
  };

  return (
    <div className="flex justify-center w-full mb-8 md:mb-12 px-4">
      <div
        role="tablist"
        aria-orientation="horizontal"
        className="inline-flex items-center justify-center rounded-lg p-2 h-12 border dark:border-gray-700 w-full max-w-md md:w-auto"
      >
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'cloud'}
          onClick={() => handleTabChange('cloud')}
          className={`inline-flex items-center justify-center rounded-md px-2 md:px-3 py-1 text-sm md:text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 gap-x-2 flex-1 md:flex-initial ${
            activeTab === 'cloud'
              ? 'bg-gray-100 text-black shadow dark:bg-gray-800 dark:text-white'
              : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 15a4.5 4.5 0 004.5 4.5H18a3.75 3.75 0 001.332-7.257 3 3 0 00-3.758-3.848 5.25 5.25 0 00-10.233 2.33A4.502 4.502 0 002.25 15z" />
          </svg>
          Nhost Cloud
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'self-hosted'}
          onClick={() => handleTabChange('self-hosted')}
          className={`inline-flex items-center justify-center rounded-md px-2 md:px-3 py-1 text-sm md:text-base font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 gap-x-2 flex-1 md:flex-initial ${
            activeTab === 'self-hosted'
              ? 'bg-gray-100 text-black shadow dark:bg-gray-800 dark:text-white'
              : 'hover:text-black dark:hover:text-white'
          }`}
        >
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor" className="h-5 w-5 flex-shrink-0">
            <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 17.25v-.228a4.5 4.5 0 00-.12-1.03l-2.268-9.64a3.375 3.375 0 00-3.285-2.602H7.923a3.375 3.375 0 00-3.285 2.602l-2.268 9.64a4.5 4.5 0 00-.12 1.03v.228m19.5 0a3 3 0 01-3 3H5.25a3 3 0 01-3-3m19.5 0a3 3 0 00-3-3H5.25a3 3 0 00-3 3m16.5 0h.008v.008h-.008v-.008zm-3 0h.008v.008h-.008v-.008z" />
          </svg>
          Self Hosted
        </button>
      </div>
    </div>
  );
};


export default function PricingPage() {
  const [activeTab, setActiveTab] = useState('cloud');

  const handleTabChange = (tab: string) => {
    setActiveTab(tab);
  };

  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl pt-12 pb-4 px-4 md:pt-20 lg:pt-28 lg:pb-12"
      >
        <LineGrid
          className="left-0 right-0 top-5 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
          slotProps={{ image: { className: 'mx-auto' } }}
          priority
        />
        <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />

        <SectionHeading
          title="Predictable pricing for your infrastructure"
          slotProps={{
            title: {
              component: 'h1',
              className: 'text-3.5xl md:text-4xl',
            },
          }}
          className="relative z-10 pb-8 lg:pb-16"
        />
      </Container>

      <PricingTabs onTabChange={handleTabChange} />

      <Container className={`grid w-full grid-flow-row justify-items-center gap-4 pb-8 px-4 ${
        activeTab === 'cloud'
          ? 'grid-cols-1 md:grid-cols-2 lg:grid-cols-4'
          : 'grid-cols-1 lg:grid-cols-2 lg:max-w-4xl lg:justify-center'
      }`}>
        {activeTab === 'cloud' ? (
          <>
            {/* Starter plan  */}
            <div className="mt-14 w-full max-w-[500px] space-y-6 md:space-y-8 self-start overflow-hidden rounded-md border border-divider p-4 md:p-8">
              <div className="flex flex-col space-y-4 ">
                <div className="flex flex-col space-y-1 mb-3">
                  <div className="flex flex-row justify-between">
                    <h2 className="font-mona text-2xl font-semibold">Starter</h2>
                  </div>
                  <h2 className="font-normal text-white text-opacity-65">
                    Get your idea off the ground for free.
                  </h2>
                </div>

                <div className="flex flex-col items-start">
                  <div className="flex flex-row items-center space-x-2">
                    <h2 className="font-mona text-4xl font-medium">$0</h2>
                    <h2 className="mt-1 font-normal text-white text-opacity-65">
                      / month
                    </h2>
                  </div>
                  <div className="p-1">Limit of 1 project. Project paused after 1 week of inactivity.</div>
                </div>
              </div>

              <PricingFeature
                subFeatures={[
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
                href="https://app.nhost.io"
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

                  <div className="flex flex-col space-y-1 mb-3">
                    <div className="flex flex-row justify-between">
                      <h2 className="font-mona text-2xl font-semibold">Pro</h2>
                    </div>
                    <h2 className="font-normal text-white text-opacity-65">
                      Well suited for production applications, scale as needed.
                    </h2>
                  </div>

                  <div className="flex flex-col items-start">
                    <h2 className="mt-1 font-normal text-white text-opacity-65 mb-2">
                      From
                    </h2>
                    <div className="flex flex-row items-center space-x-2">
                      <h2 className="font-mona text-4xl font-medium">$25</h2>
                      <h2 className="mt-1 font-normal text-white text-opacity-65">
                        / month
                      </h2>
                    </div>
                  <div className="p-1">$15 in compute credits included</div>
                  </div>
                </div>

                <h2 className="font-sm mt-1 text-white text-opacity-65">
                  Everything in Starter plus:
                </h2>

                <PricingFeature
                  subFeatures={[
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
                      title: 'Point in time recovery',
                    },
                    {
                      title: 'Bring your own services',
                    },
                    {
                      title: 'Managed Grafana (Metrics & Alerting)',
                    },
                    {
                      title: 'Email support',
                    },
                    {
                      title: 'Addons (AI toolkit, custom domains, etc)',
                    },
                  ]}
                />

                <Button
                  className=""
                  href="https://app.nhost.io"
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
                <div className="flex flex-col space-y-1 mb-3">
                  <div className="flex flex-row justify-between">
                    <h2 className="font-mona text-2xl font-semibold">Team</h2>
                  </div>
                  <h2 className="font-normal text-white text-opacity-65">
                    Collaborate with added support, scale as needed.
                  </h2>
                </div>

                <div className="flex flex-col items-start">
                  <h2 className="mt-1 font-normal text-white text-opacity-65 mb-2">
                    From
                  </h2>
                  <div className="flex flex-row items-center space-x-2">
                    <h2 className="font-mona text-4xl font-medium">$599</h2>
                    <h2 className="mt-1 font-normal text-white text-opacity-65">
                      / month
                    </h2>
                  </div>
                  <div className="p-1">$15 in compute credits included</div>
                </div>
              </div>

              <h2 className="font-sm mt-1 text-white text-opacity-65">
                Everything in Pro plus:
              </h2>

              <PricingFeature
                subFeatures={[
                  {
                    title: 'SOC 2 Type II',
                  },
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
                    title: 'HIPAA (coming soon)',
                  },
                ]}
              />

              <Button
                href="https://app.nhost.io"
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
                <div className="flex flex-col space-y-1 mb-3">
                  <h2 className="font-mona text-2xl font-semibold">Enterprise</h2>

                  <h2 className="font-normal text-white text-opacity-65">
                    Ideal for specific infrastructure and customization needs.
                  </h2>
                </div>

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
          </>
        ) : (
          <>
            {/* Self Hosted plan */}
            <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
              <div className="flex flex-col space-y-4 ">
                <h2 className="font-mona text-2xl font-semibold">Self Hosted OSS</h2>
                <h2 className="font-normal text-white text-opacity-65">
                  Nhost on your own infrastructure, no strings attached.
                </h2>
                <div className="flex flex-col items-start">
                  <div className="flex flex-row items-center space-x-2">
                    <h2 className="font-mona text-4xl font-medium">Free, open-source</h2>
                  </div>
                </div>
              </div>

              <PricingFeature
                subFeatures={[
                  { title: 'Your own infrastructure' },
                  { title: 'Runs on Docker, Kubernetes, VMs, Bare Metal, etc.' },
                  { title: 'Discord Community Support' },
                ]}
              />

              <Button
                href="https://discord.com/invite/9V7Qb2U"
                rel="noopener noreferrer"
                target="_blank"
                className="col-span-2 w-full justify-center text-center"
              >
                Join our Discord <ArrowRightIcon />
              </Button>
            </div>

            {/* Self Hosted Enterprise plan */}
            <div className="mt-14 w-full max-w-[500px] space-y-8 self-start overflow-hidden rounded-md border border-divider p-8">
              <div className="flex flex-col space-y-4 ">
                <h2 className="font-mona text-2xl font-semibold">Self Hosted Enterprise</h2>
                <h2 className="font-normal text-white text-opacity-65">
                  Extend your backend and infrastructure teams with our expertise.
                </h2>
                <div className="flex flex-col items-start">
                  <div className="flex flex-row items-center space-x-2">
                    <h2 className="font-mona text-4xl font-medium">Custom</h2>
                  </div>
                </div>
              </div>

              <PricingFeature
                subFeatures={[
                  { title: 'All Self Hosted Features' },
                  { title: 'Custom SLAs' },
                  { title: 'Dedicated Solution Architect' },
                  { title: 'Audit & Verification of your Setup' },
                  { title: 'Training & Consulting' },
                ]}
              />

              <Button
                href="mailto:hello@nhost.io"
                rel="noopener noreferrer"
                target="_blank"
                className="col-span-2 w-full justify-center text-center"
              >
                Contact Us <ArrowRightIcon />
              </Button>
            </div>
          </>
        )}
      </Container>

      <Container
        slotProps={{
          root: {
            className: 'sticky top-0 bg-black hidden md:block transform-cpu',
          },
        }}
        className={`relative grid auto-cols-fr grid-flow-col content-start gap-6 pt-20 pb-4 ${
          activeTab === 'cloud' ? 'grid-cols-17' : 'grid-cols-11'
        }`}
      >
        {activeTab === 'cloud' ? (
          <>
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
                href="https://app.nhost.io"
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
                href="https://app.nhost.io"
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
                href="https://app.nhost.io"
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
          </>
        ) : (
          <>
            <div className="col-span-5" />
            <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
              <SectionHeading
                title="Self Hosted OSS"
                subtitle="Free, open-source"
                className="gap-2"
                slotProps={{
                  title: { className: 'text-3xl md:text-3xl' },
                  subtitle: { className: 'text-base' },
                }}
              />
              <Button
                variant="borderless"
                className="justify-center text-center mx-auto"
                href="https://discord.com/invite/9V7Qb2U"
                target="_blank"
                rel="noopener noreferrer"
              >
                Join our Discord
              </Button>
            </div>
            <div className="col-span-3 grid grid-flow-row content-between justify-center gap-6">
              <SectionHeading
                title="Self Hosted Enterprise"
                subtitle="Custom"
                className="gap-2"
                slotProps={{
                  title: { className: 'text-3xl md:text-3xl' },
                  subtitle: { className: 'text-base' },
                }}
              />
              <Button
                variant="borderless"
                className="justify-center text-center mx-auto"
                href="mailto:hello@nhost.io"
                target="_blank"
                rel="noopener noreferrer"
              >
                Contact Us
              </Button>
            </div>
          </>
        )}
      </Container>

      <Container className="grid auto-rows-auto items-start gap-8 pb-28">
        {activeTab === 'cloud' ? (
          <>
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
                  title="Automated backups"
                  titleTooltip="Daily backups of your database that can be restored."
                  starterIcon="x"
                  proContent="7 days of backups"
                  teamContent="7 days of backups"
                  enterpriseContent="Custom"
                />
                <PricingListItem
                  title="Point in time recovery"
                  titleTooltip="Recover to any point between backups"
                  starterIcon="x"
                  proContent="Starts at $100 with 7 days retention"
                  teamContent="Starts at $100 with 7 days retention"
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
                  proContent="180 sec"
                  teamContent="600 sec"
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
                  teamIcon="check"
                  enterpriseIcon="check"
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
          </>
        ) : (
          <>
            <section className="mt-4">
              <h3 className="py-4 text-xl">Database</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Dedicated Postgres instance"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Database size"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
                <SelfHostedPricingListItem
                  title="Automated backups"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Point in time recovery"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Hasura GraphQL</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Hasura GraphQL Engine"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Realtime subscriptions"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Event triggers"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Role based authorization"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Advanced GraphQL features"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Authentication</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Total users"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
                <SelfHostedPricingListItem
                  title="Social OAuth providers"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="WebAuthn / FIDO2"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Email / Password"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Magic Link"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="2FA"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Custom SMTP"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Custom emails"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Advanced security features"
                  ossIcon="x"
                  enterpriseContent="Contact Us"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Storage</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Storage size"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
                <SelfHostedPricingListItem
                  title="Custom permissions"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Image transformation"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Global CDN"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Functions</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Total functions"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
                <SelfHostedPricingListItem
                  title="Execution"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
                <SelfHostedPricingListItem
                  title="Execution Time"
                  ossContent="Unlimited"
                  enterpriseContent="Unlimited"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">AI Toolkit</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="pgvector"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Graphite"
                  ossContent="License Required"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Auto-Embeddings"
                  ossContent="License Required"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Nhost Assistants"
                  ossContent="License Required"
                  enterpriseIcon="check"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Platform</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="HTTPS / SSL"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Compute resources"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Service replicas"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Custom domains"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="External databases"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Auto scaling"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="99.9% SLA"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Dedicated clusters"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Observability</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Nhost Logs"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
                <SelfHostedPricingListItem
                  title="Managed Grafana for metrics"
                  ossContent="Self-managed"
                  enterpriseContent="Self-managed with Nhost Support"
                />
              </ul>
            </section>

            <section>
              <h3 className="py-4 text-xl">Support</h3>
              <ul className="grid grid-flow-row divide-y divide-divider border-y border-divider">
                <SelfHostedPricingListItem
                  title="Community"
                  ossIcon="check"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Email"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Email SLA"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Dedicated Discord channel"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Security questionnaire"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Dedicated technical account manager"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="24x7x365 support with SLA"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="Architecture review"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
                <SelfHostedPricingListItem
                  title="On boarding"
                  ossIcon="x"
                  enterpriseIcon="check"
                />
              </ul>
            </section>
          </>
        )}
      </Container>

      <section className="col-span-3 mx-auto mt-4 grid max-w-5xl grid-flow-row gap-6 px-4">
        <SectionHeading
          title="Compute Pricing"
          subtitle="Billed by the minute"
        />

        <div className="flex flex-col md:flex-row justify-center gap-4 md:gap-8">
          <div className="bg-background flex flex-col items-center justify-start gap-4 rounded-lg border border-black border-opacity-5 pb-8 md:pb-16 w-full md:w-[300px]">
            <h3 className="text-xl font-semibold mt-4">Dedicated</h3>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="inline-flex items-center justify-center gap-[4px] p-[0px]">
                <h2 className="font-mona text-2xl font-semibold">$</h2>
                <h2 className="font-mona text-2xl font-semibold">50</h2>
              </div>
              <div className="text-[16px] font-normal leading-snug text-gray-300">
                Per vCPU core / month
              </div>
              <div className="text-[14px] font-normal leading-snug text-gray-300 text-opacity-50">
                $0.0012 / vCPU / minute
              </div>
            </div>
            <div className="flex h-[38px] flex-col items-center justify-start gap-4 self-stretch p-[0px]">
              <div className="inline-flex h-[1px] w-[270px] items-center justify-center p-[0px]">
                <div className="h-[1px] w-[270px] bg-black bg-opacity-5 dark:bg-gray-100"></div>
              </div>
              <div className="text-[14px] font-normal leading-tight text-gray-500">
                2 GB of memory for each vCPU
              </div>
            </div>
          </div>

          <div className="bg-background flex flex-col items-center justify-start gap-4 rounded-lg border border-black border-opacity-5 pb-16 w-[300px]">
            <h3 className="text-xl font-semibold mt-4">Shared</h3>
            <div className="flex flex-col items-center justify-center gap-2">
              <div className="inline-flex items-center justify-center gap-[4px] p-[0px]">
                <h2 className="font-mona text-2xl font-semibold">$</h2>
                <h2 className="font-mona text-2xl font-semibold">15</h2>
              </div>
              <div className="text-[16px] font-normal leading-snug text-gray-300">
                Per vCPU core / month
              </div>
              <div className="text-[14px] font-normal leading-snug text-gray-300 text-opacity-50">
                $0.00034 / vCPU / minute
              </div>
            </div>
            <div className="flex h-[38px] flex-col items-center justify-start gap-4 self-stretch p-[0px]">
              <div className="inline-flex h-[1px] w-[270px] items-center justify-center p-[0px]">
                <div className="h-[1px] w-[270px] bg-black bg-opacity-5 dark:bg-gray-100"></div>
              </div>
              <div className="text-[14px] font-normal leading-tight text-gray-500">
                2 GB of memory for each vCPU
              </div>
            </div>
          </div>
        </div>
      </section>

      <section className="col-span-3 mx-auto mt-4 grid max-w-5xl grid-flow-row gap-8 md:gap-16 p-4 md:p-8">
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
            <h3 className="text-xl">Are plans per organization?</h3>

            <p className="text-base">Yes, plans are per organization. One invoice for all your projects</p>
          </li>
          <li className="grid grid-flow-row gap-4 py-6">
            <h3 className="text-xl">
              How many free projects can I have?
            </h3>

            <p className="text-base">You can have as many projects as you want in a free organization, as long as only 1 is active at any given time. You can pause and unpause free projects as needed.</p>
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
