import { Button } from '@/components/Button'
import { Container } from '@/components/Container'
import ArrowRightIcon from '@/components/icons/ArrowRightIcon'
import { Layout } from '@/components/Layout'
import Image from 'next/image'
import { ReactElement } from 'react'

export default function IndexPage() {
  return (
    <>
      <Container component="section">
        <div className="grid grid-flow-row justify-center gap-10 pt-25">
          <div className="lg:py- grid max-w-2xl grid-flow-row gap-4 text-center">
            <h1 className="font-mona text-5xl font-bold">
              Build apps users{' '}
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                love
              </span>
            </h1>

            <p className="text-xl text-white text-opacity-60">
              Nhost is a backend as an open-source backend development platform
              enables <strong>developers</strong> to <strong>build</strong> and{' '}
              <strong>scale</strong> their web and mobile <strong>apps</strong>.
            </p>
          </div>

          <Button
            className="justify-self-center text-base"
            href="https://app.nhost.io/sign-up"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start building <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <Container
        component="section"
        className="grid grid-flow-row justify-center gap-12 text-center"
      >
        <h2 className="text-base text-white text-opacity-60">
          Trusted by developers
        </h2>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:gap-x-12 lg:gap-y-8">
          <Image
            src="/brands/brand-hearst.svg"
            alt="Hearst Logo"
            width={139}
            height={18}
          />

          <Image
            src="/brands/brand-btg.svg"
            alt="BTG Pactual Logo"
            width={99}
            height={39}
          />

          <Image
            src="/brands/brand-wattpad.svg"
            alt="Wattpad Logo"
            width={117}
            height={32}
          />

          <Image
            src="/brands/brand-biogen.svg"
            alt="Biogen Logo"
            width={69}
            height={22}
          />

          <Image
            src="/brands/brand-hexagon.svg"
            alt="Hexagon Logo"
            width={121}
            height={20}
          />

          <Image
            src="/brands/brand-maze.svg"
            alt="Maze Logo"
            width={123}
            height={22}
          />

          <Image
            src="/brands/brand-productboard.svg"
            alt="Productboard Logo"
            width={171}
            height={22}
          />
        </div>
      </Container>
    </>
  )
}

IndexPage.getLayout = function getLayout(page: ReactElement) {
  return (
    <Layout className="grid grid-flow-row content-start justify-center gap-14">
      {page}
    </Layout>
  )
}
