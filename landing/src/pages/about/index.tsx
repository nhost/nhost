import { Container } from '@/components/common/Container'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function AboutPage() {
  return (
    <Container className="pt-8 pb-16 lg:pt-28 lg:pb-28">
      <div className="relative">
        <div className="bg-transparent-to-black-radial-gradient absolute top-1/2 left-0 right-0 bottom-0 z-0 mx-auto h-28 w-28 -translate-y-1/2" />
        <LineGrid
          className="left-0 right-0 top-1/2 mx-auto h-28 w-28 -translate-y-1/2"
          slotProps={{ image: { className: 'opacity-100' } }}
        />
        <Image
          src="/common/logo-shape.svg"
          width={24}
          height={24}
          alt="Nhost Logo"
          priority
          className="leading relative z-10 mx-auto h-16 w-16 object-contain"
        />
      </div>

      <SectionHeading
        title="We enable developers to build apps users love"
        subtitle="To the builders of the world. We admire and support you!"
        className="mt-12"
        slotProps={{
          title: {
            component: 'h1',
            className: '!leading-normal md:text-5xl',
          },
        }}
      />

      <section className="relative mt-25 lg:mt-40">
        <SectionHeading
          title="Team"
          subtitle="Nhost has been remote and global first from day 0"
          slotProps={{
            title: {
              className: 'font-semibold',
            },
          }}
        />

        <Image
          src="/images/team-map.png"
          alt="World Map with glowing Nhost logos where team members are located"
          width={2265}
          height={1304}
          quality={90}
          className="min-h-[315px] object-cover"
        />

        <div className="relative z-0 -mt-24 h-72 overflow-hidden bg-black">
          <LineGrid className="opacity-65" />
          <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-20 h-full w-full" />
          <div className="border-gradient relative z-30 mx-auto h-px w-10/12" />
          <div className="bg-black-to-transparent absolute -bottom-[300px] z-20 h-[664px] w-full" />
          <div className="absolute -top-4 left-0 right-0 mx-auto h-16 w-2/3 rounded-full bg-brand-main blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto -mt-64 flex w-full max-w-5xl flex-row flex-wrap justify-around gap-6">
          <div className="grid grid-flow-row gap-2 text-center">
            <p className="font-mona text-3.5xl font-bold lg:text-5xl">9</p>
            <p className="text-base">Nationalities</p>
          </div>
          <div className="grid grid-flow-row gap-2 text-center">
            <p className="font-mona text-3.5xl font-bold lg:text-5xl">7</p>
            <p className="text-base">Languages</p>
          </div>
          <div className="grid grid-flow-row gap-2 text-center">
            <p className="font-mona text-3.5xl font-bold lg:text-5xl">4</p>
            <p className="text-base">Timezones</p>
          </div>
          <div className="grid grid-flow-row gap-2 text-center">
            <p className="font-mona text-3.5xl font-bold lg:text-5xl">2</p>
            <p className="text-base">Continents</p>
          </div>
          <div className="grid grid-flow-row gap-2 text-center">
            <p className="font-mona text-3.5xl font-bold lg:text-5xl">100%</p>
            <p className="text-base">Remote</p>
          </div>
        </div>
      </section>
    </Container>
  )
}

AboutPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
