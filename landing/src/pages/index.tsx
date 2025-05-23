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
import LovedBySection from '@/components/home/LovedBySection/LovelBySection'

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
              subtitle="Nhost provides a complete backend with PostgreSQL, GraphQL, authentication, storage, functions, custom services, and AI features."
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
