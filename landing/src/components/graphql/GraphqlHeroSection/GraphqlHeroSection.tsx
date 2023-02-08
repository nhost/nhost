import { Container } from '@/components/common/Container'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

export default function GraphqlHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-start gap-14 sm:gap-6 md:grid-cols-2"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 pt-16 md:pt-42 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/graphql.svg"
            width={24}
            height={24}
            alt="Logo of GraphQL"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title="GraphQL API"
          subtitle="Instant and scalable GraphQL API with realtime subscriptions and powerful permissions built in."
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold',
            },
            subtitle: { className: 'text-base !leading-normal' },
          }}
        />
      </div>

      <div className="relative md:pt-20 lg:pt-0">
        <Image
          src="/products/graphql-hero.svg"
          width={608}
          height={608}
          alt="GraphQL logo"
          className="mx-auto h-full max-h-[400px] w-full object-none md:max-h-[none] md:object-none xl:-translate-y-4"
          priority
        />
      </div>
    </Container>
  )
}
