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
        <div className="mt-8 grid grid-flow-row justify-center gap-10 pt-8 md:pt-25">
          <SectionHeading
            title={
              <>
                Launch in minutes <br />
                <span className="relative bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">
                  Scale without limits
                  <span className="absolute -inset-1 -z-10 block animate-pulse bg-gradient-to-br from-brand-light via-brand-main to-brand-dark opacity-30 blur-xl"></span>
                </span>
              </>
            }
            subtitle={
              <>
                Nhost is a fully managed, extensible backend platform designed
                for speed, flexibility, and scale - without the infrastructure
                headaches.
              </>
            }
            slotProps={{
              title: {
                component: 'h1',
                className: 'text-3.5xl md:text-5xl font-bold',
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
              href="https://app.nhost.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Get started for free <ArrowRightIcon />
            </Button>
            <Button
              variant="outlined"
              className="text-center text-base"
              href="https://docs.nhost.io"
              target="_blank"
            >
              Explore the docs
            </Button>
          </div>
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

        <div className="relative mx-auto max-w-6xl">
          <div className="absolute -top-6 -left-6 -right-6 -bottom-6 rounded-lg border border-white border-opacity-10 bg-white bg-opacity-[0.02] backdrop-blur-sm"></div>

          <Image
            src="/images/overview.png"
            alt="The Nhost Dashboard's overview page"
            width={1442}
            height={902}
            quality={90}
            className={twMerge(
              'relative z-10 mx-auto w-full max-w-5xl rounded shadow-2xl ring-1 ring-white ring-opacity-10',
              imageLoaded ? 'animate-slide-middle-up' : 'opacity-0',
            )}
            onLoadingComplete={() => setImageLoaded(true)}
            priority
            sizes="(max-width: 1024px) 50vw, 60vw"
          />
        </div>

        <div className="absolute -bottom-32 left-0 right-0 z-30 h-36 w-full bg-black"></div>
      </section>
    </>
  )
}
