import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'

export interface CTASectionProps extends ContainerProps {}

export default function CTASection({ className, ...props }: CTASectionProps) {
  return (
    <Container
      component="section"
      className={twMerge(
        'grid grid-flow-row pt-8 pb-24 lg:pt-12 lg:pb-40',
        className,
      )}
      {...props}
    >
      <Image
        src="/images/glowing-logo.png"
        width={588}
        height={420}
        alt="Glowing logo of Nhost"
        sizes="(max-width: 640px) 330px, (max-width: 1200px) 588px, 588px"
        className="z-0 mx-auto -translate-x-4"
      />

      <div className="z-10 mx-auto -mt-24 grid grid-flow-row content-start justify-items-center gap-4 lg:-mt-32">
        <h2 className="text-center font-mona text-3.5xl font-semibold md:text-4.5xl">
          Ready to try Nhost?
        </h2>

        <p className="text-center text-xl font-normal text-white text-opacity-65">
          Get in touch.
        </p>

        <div className="grid grid-flow-row items-center gap-4 pt-2 md:grid-flow-col md:gap-6">
          <Button
            className="text-base"
            href="https://app.nhost.io"
            target="_blank"
            rel="noopener noreferrer"
          >
            Start building <ArrowRightIcon />
          </Button>{' '}
          <p className="text-base font-medium">Questions? Talk to us.</p>
        </div>
      </div>
    </Container>
  )
}
