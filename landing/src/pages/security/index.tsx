import { Container } from "@/components/common/Container";
import { Glow } from "@/components/common/Glow";
import { SecurityFeatures } from "@/components/security/SecurityFeatures";
import { LineGrid } from "@/components/common/LineGrid";
import { SectionHeading } from "@/components/common/SectionHeading";
import { Layout } from '@/components/common/Layout'
import { ReactElement } from "react";

export default function SecurityPage() {
  return (
    <>
      <Container
        component="section"
        className="relative flex max-w-5xl py-20 lg:py-28"
      >
          <LineGrid
            className="top-5 left-0 right-0 mx-auto h-32 w-32 translate-x-0 scale-100 lg:top-16 lg:h-40 lg:w-40"
            slotProps={{ image: { className: 'mx-auto' } }}
            priority
          />
          <Glow className="top-5 h-32 w-32 bg-opacity-50 blur-3xl lg:top-16" />
          <SectionHeading
            title="Security at Nhost"
            subtitle="Engineering teams of all sizes trust Nhost to build and deploy secure applications."
            slotProps={{
              title: {
                component: 'h1',
                className: 'text-3.5xl md:text-5xl md:leading-normal',
              },
            }}
            className="relative z-10"
          />
      </Container>

      <SecurityFeatures />
    </>
  )
}

SecurityPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
