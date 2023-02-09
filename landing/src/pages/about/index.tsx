import { Container } from '@/components/common/Container'
import { InvestorCard } from '@/components/common/InvestorCard'
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
        className="mt-12 max-w-xl"
        slotProps={{
          title: {
            component: 'h1',
            className: '!leading-normal md:text-5xl',
          },
        }}
      />

      <div className="mt-10 h-px w-full bg-white bg-opacity-7 lg:mt-20" />

      <section className="relative z-0 mt-16 lg:mt-24">
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
          priority
          className="min-h-[315px] object-cover"
        />

        <div className="relative z-0 -mt-24 h-72 overflow-hidden bg-black">
          <LineGrid
            slotProps={{ image: { className: 'w-full object-left' } }}
          />
          <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-20 h-full w-full" />
          <div className="border-gradient relative z-30 mx-auto h-px w-10/12" />
          <div className="bg-black-to-transparent absolute -bottom-[300px] z-20 h-[664px] w-full" />
          <div className="backface-hidden absolute -top-4 left-0 right-0 mx-auto h-16 w-[60%] rounded-full bg-brand-main blur-3xl" />
        </div>

        <div className="relative z-10 mx-auto -mt-64 flex w-full max-w-5xl flex-row flex-wrap justify-evenly gap-6 md:justify-around">
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

      <section className="relative z-10 mt-25 grid grid-flow-row gap-8 lg:mt-40 lg:gap-16">
        <SectionHeading
          title="Investors"
          slotProps={{ title: { className: 'font-semibold' } }}
        />

        <div className="mx-auto flex max-w-3xl flex-row flex-wrap justify-center gap-6">
          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/guillem-sague.jpg"
                alt="Avatar of Guillem Sauge"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            logo={
              <Image
                src="/investors/logos/nauta-capital.png"
                alt="Logo of Nauta Capital"
                width={122}
                height={24}
                quality={90}
              />
            }
            name="Guillem Sauge"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/anders-hammarbaeck.jpg"
                alt="Avatar of Anders Hammarbäck"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            logo={
              <Image
                src="/investors/logos/antler.svg"
                alt="Logo of Antler"
                width={100}
                height={24}
              />
            }
            name="Anders Hammarbäck"
          />

          <InvestorCard
            avatar={
              <Image
                src="/investors/avatars/wladimir-miroschnikow.jpg"
                alt="Avatar of Wladimir Miroschnikow"
                width={48}
                height={48}
              />
            }
            logo={
              <Image
                src="/investors/logos/scne.svg"
                alt="Logo of Scne"
                width={67}
                height={24}
              />
            }
            name="Wladimir Miroschnikow"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/tom-werner.jpg"
                alt="Avatar of Tom Preston-Werner"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            name="Tom Preston-Werner"
            position="Founder - GitHub"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/mathias-biilmann-christensen.jpg"
                alt="Avatar of Mathias Biilmann Christensen"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            name="Mathias Biilmann Christensen"
            position="CEO - Netlify"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/chris-bach.jpg"
                alt="Avatar of Christian (Chris) Bach"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            name="Christian (Chris) Bach"
            position="Co-founder - Netlify"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/michael-grinich.jpg"
                alt="Avatar of Michael Grinich"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            name="Michael Grinich"
            position="CEO - WorkOS"
          />

          <InvestorCard
            className="w-full flex-auto shrink-0"
            avatar={
              <Image
                src="/investors/avatars/marcus-bostroem.jpg"
                alt="Avatar of Marcus Boström"
                width={48}
                height={48}
                className="h-12 w-12"
              />
            }
            name="Marcus Boström"
            position="Founder - Vården.se"
          />
        </div>
      </section>
    </Container>
  )
}

AboutPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
