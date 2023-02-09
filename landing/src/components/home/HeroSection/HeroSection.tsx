import { Button } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

export default function HeroSection() {
  const [imageLoaded, setImageLoaded] = useState(false)

  return (
    <>
      <Container component="section" className="relative pb-5 lg:pb-11">
        <div className="grid grid-flow-row justify-center gap-10 pt-8 md:pt-25">
          <SectionHeading
            title={
              <>
                Build apps users{' '}
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                  love
                </span>
              </>
            }
            subtitle={
              <>
                Nhost is a an open-source backend and development platform that
                enables <strong>developers</strong> to <strong>build</strong>{' '}
                and <strong>scale</strong> their web and mobile{' '}
                <strong>apps</strong>.
              </>
            }
            slotProps={{
              title: {
                component: 'h1',
                className: 'text-3.5xl md:text-5xl font-bold',
              },
            }}
          />

          <Button
            className="justify-self-center text-center text-base"
            href="https://app.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start building <ArrowRightIcon />
          </Button>
        </div>
      </Container>

      <section className="relative mx-auto px-5 pt-14">
        <Glow
          className={twMerge(
            'z-0 mx-auto h-full w-full max-w-5xl bg-opacity-50 blur-3xl',
            imageLoaded ? 'animate-fade-in-delay opacity-0' : 'opacity-0',
          )}
        />
        <div className="bg-black-to-transparent absolute top-0 left-0 right-0 z-20 h-full w-full" />

        <Image
          src="/images/overview.png"
          alt="The Nhost Dashboard's overview page"
          width={1442}
          height={902}
          quality={90}
          className={twMerge(
            'relative z-10 mx-auto w-full max-w-5xl',
            imageLoaded ? 'animate-slide-middle-up' : 'opacity-0',
          )}
          onLoadingComplete={() => setImageLoaded(true)}
          priority
          sizes="(max-width: 1024px) 50vw, 60vw"
        />

        <div className="absolute -bottom-32 left-0 right-0 z-30 h-36 w-full bg-black"></div>
      </section>
    </>
  )
}
