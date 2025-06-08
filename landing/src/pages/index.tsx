import { ScaleSection } from '@/components/home/ScaleSection'
import { CTASection } from '@/components/common/CTASection'
import { Layout } from '@/components/common/Layout'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ExamplesSection } from '@/components/home/ExamplesSection'
import { HeroSection } from '@/components/home/HeroSection'
import TrustedBySection from '@/components/home/TrustedBySection/TrustedBySection'
import { WorkflowSection } from '@/components/home/WorkflowSection'
import { ProductSection } from '@/components/product/ProductSection'
import { ReactElement } from 'react'
import { LovedBySection } from '@/components/home/LovedBySection'

export default function IndexPage() {
  return (
    <>
      <HeroSection />
      <TrustedBySection />
      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <SectionHeading
              title="Build. Deploy. Scale."
              // subtitle="Nhost provides a complete backend with PostgreSQL, GraphQL, authentication, storage, functions, custom services, and AI features."
              // subtitle="Nhost provides a ready-to-use stack with PostgreSQL, GraphQL, Auth, Storage, plus tools to extend it like Functions, Run, and an AI toolkit."
              subtitle="A complete backend stack, ready to use and easy to extend."
            />
          </div>
        }
      />
      <LovedBySection />
      <ScaleSection />
      <WorkflowSection />
      <ExamplesSection />
      <CTASection />
    </>
  )
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
