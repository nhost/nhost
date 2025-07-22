import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { Card } from '@/components/common/Card'
import { CTASection } from '@/components/common/CTASection'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { ReactElement } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function SupabaseVsNhostPage() {
  return (
    <>
      {/* hero section */}
      <Container component="section" className="relative pb-5 lg:pb-11">
        <div className="mt-8 grid grid-flow-row justify-center gap-10 pt-8 md:pt-25">
          <SectionHeading
            title="The scalable Supabase alternative"
            subtitle="Here's why developers building scalable, GraphQL-native, and customizable apps choose Nhost instead."
            slotProps={{
              title: {
                component: 'h1',
                className: 'text-3.5xl md:text-5xl font-bold ',
              },
              subtitle: {
                className:
                  'max-w-2xl mx-auto text-lg text-white text-opacity-80',
              },
            }}
          />

          <div className="flex gap-4 justify-self-center">
            <Button
              className="text-center text-base"
              href="https://app.nhost.io/signup"
              target="_blank"
              rel="noopener noreferrer"
            >
              Deploy your backend now <ArrowRightIcon />
            </Button>
            <Button
              variant="outlined"
              className="text-center text-base"
              href="/blog/nhost-vs-supabase-practical-guide-for-growing-teams"
            >
              Read the full comparison
            </Button>
          </div>
        </div>
      </Container>

      {/* feature comparison table */}
      <Container component="section" className="max-w-6xl py-16">
        <SectionHeading
          title="Feature comparison"
          subtitle="See how Nhost and Supabase stack up across key capabilities"
          className="mb-12"
        />

        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b border-gray-700">
                <th className="py-4 px-6 text-left font-semibold text-gray-300">
                  Feature
                </th>
                <th className="py-4 px-6 text-left font-semibold text-gray-300">
                  Supabase
                </th>
                <th className="py-4 px-6 text-left font-semibold text-blue-400">
                  Nhost
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-700">
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Query Language
                </td>
                <td className="py-4 px-6 text-gray-300">
                  SQL + JS client (REST + RPC)
                </td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  GraphQL-native with any GraphQL client
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Postgres Access
                </td>
                <td className="py-4 px-6 text-gray-300">Root access</td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Root access
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Extensibility
                </td>
                <td className="py-4 px-6 text-gray-300">
                  Edge functions (Deno-based), limited customization
                </td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Serverless Functions (Lambda-based) + Nhost Run (bring your
                  own containers), GraphQL federation with remote schemas
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">Auth</td>
                <td className="py-4 px-6 text-gray-300">
                  Feature-rich, RLS-based, Complex
                </td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Feature-rich, easy permissions with roles and field-level
                  access
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">AI agents</td>
                <td className="py-4 px-6 text-gray-300">No native support</td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  AI Agents integrated with all Nhost core backend services
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Developer tooling
                </td>
                <td className="py-4 px-6 text-gray-300">
                  CLI + SQL migrations
                </td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Git-based deployments + GraphQL-first DX
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Infrastructure control
                </td>
                <td className="py-4 px-6 text-gray-300">
                  Managed Postgres, multi-tenant auth & storage
                </td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Single tenant on all services, Kubernetes-native, supports
                  dedicated clusters
                </td>
              </tr>
              <tr className="hover:bg-gray-800/50">
                <td className="py-4 px-6 font-medium text-white">
                  Federation support
                </td>
                <td className="py-4 px-6 text-gray-300">No support</td>
                <td className="py-4 px-6 font-semibold text-blue-300">
                  Native support with Remote Schemas / Nhost Run
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        <div className="mt-8 text-center">
          <Button
            href="/blog/nhost-vs-supabase-practical-guide-for-growing-teams"
            variant="outlined"
          >
            View the full comparison guide
          </Button>
        </div>
      </Container>

      <Container component="section" className="max-w-6xl py-16">
        <SectionHeading
          title="Built for flexibility, designed for scale"
          subtitle="Why growing teams choose Nhost for their production applications"
          className="mb-16"
        />

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2 lg:grid-cols-4">
          <Card className="border-gray-700 bg-gray-900/50 p-6">
            <div className="mb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-black ring-1 ring-white ring-opacity-10">
                <Image
                  src="/products/graphql.svg"
                  width={24}
                  height={24}
                  alt="GraphQL icon"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                GraphQL-first developer experience
              </h3>
            </div>
            <p className="text-gray-300">
              No wrappers, no patchwork APIs. Nhost is built from the ground up
              for GraphQL and frontend productivity.
            </p>
          </Card>

          <Card className="border-gray-700 bg-gray-900/50 p-6">
            <div className="mb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-black ring-1 ring-white ring-opacity-10">
                <Image
                  src="/products/run-cloud.svg"
                  width={24}
                  height={24}
                  alt="Nhost Run icon"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                Extensible without limits
              </h3>
            </div>
            <p className="text-gray-300">
              Deploy your own services as containers with Nhost Run. Wire up
              remote GraphQL APIs. Use event triggers to react to database
              changes.
            </p>
          </Card>

          <Card className="border-gray-700 bg-gray-900/50 p-6">
            <div className="mb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-black ring-1 ring-white ring-opacity-10">
                <Image
                  src="/products/platform.svg"
                  width={24}
                  height={24}
                  alt="Platform icon"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                Run it your way
              </h3>
            </div>
            <p className="text-gray-300">
              Use Nhost Cloud for top reliability, or deploy to your own
              infrastructure. You&apos;re not locked in, you&apos;re in control
              of your data and infrastructure.
            </p>
          </Card>

          <Card className="border-gray-700 bg-gray-900/50 p-6">
            <div className="mb-4">
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-black ring-1 ring-white ring-opacity-10">
                <Image
                  src="/products/ai-assistants.svg"
                  width={24}
                  height={24}
                  alt="AI Assistants icon"
                />
              </div>
              <h3 className="mb-2 text-xl font-semibold text-white">
                AI workflows, baked in
              </h3>
            </div>
            <p className="text-gray-300">
              Nhost includes an integrated AI service for creating AI agents,
              managing embeddings, and more, with no extra infra or setup
              required. Build powerful AI-native apps.
            </p>
          </Card>
        </div>
      </Container>

      <Container component="section" className="max-w-4xl py-16">
        <div className="mb-12 text-center">
          <h2 className="mb-4 text-3xl font-bold text-white">
            &quot;Why we chose Nhost over Supabase&quot;
          </h2>
        </div>

        <Card className="border-gray-700 bg-gray-900/50 p-8">
          <blockquote className="mb-6 text-lg italic text-gray-300">
            &quot;One of the main issues we had with Supabase was that the
            generated APIs weren&apos;t usable straight away from the client
            side. This meant that we would have had to recode an entire API
            layer on top, which would have added unnecessary complexity and
            slowed down our development process.&quot;
          </blockquote>
          <div className="flex items-center">
            <div className="mr-4 flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-r from-blue-600 to-purple-600">
              <span className="font-semibold text-white">JS</span>
            </div>
            <div>
              <div className="font-semibold text-white">Alex</div>
              <div className="text-gray-400">CPTO, Yalink</div>
            </div>
          </div>
        </Card>
      </Container>

      <Container component="section" className="max-w-4xl py-16 text-center">
        <h2 className="mb-4 text-3xl font-bold text-white">Not sure yet?</h2>
        <p className="mb-8 text-lg text-gray-300">
          Read our blog post for a practical evaluation for choosing a backend
          stack.
        </p>
        <div className="flex flex-col justify-center gap-4 sm:flex-row">
          <Button
            href="https://app.nhost.io/signup"
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-base"
          >
            Try Nhost free <ArrowRightIcon />
          </Button>
          <Button
            variant="outlined"
            href="/blog/nhost-vs-supabase-practical-guide-for-growing-teams"
            className="text-center text-base"
          >
            Read full guide
          </Button>
        </div>
      </Container>

      <CTASection />
    </>
  )
}

SupabaseVsNhostPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
