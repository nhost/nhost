import Image from 'next/image'
import { twMerge } from 'tailwind-merge'
import { Button } from '../Button'
import { Container, ContainerProps } from '../Container'
import { ArrowRightIcon } from '../icons/ArrowRightIcon'
import { Link } from '../Link'

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
        className="z-0 mx-auto -translate-x-4 animate-pulse"
      />

      <div className="z-10 mx-auto -mt-24 grid grid-flow-row content-start justify-items-center gap-4 lg:-mt-32">
        <h2 className="text-center font-mona text-3.5xl font-semibold md:text-4.5xl">
          Start Building <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Your Next Big Thing</span>
        </h2>
        
        <p className="text-center text-white text-opacity-80 max-w-lg mx-auto mb-6">
          Get a complete backend up and running in minutes. Focus on building features your users will love, not wrestling with infrastructure. No credit card required for the free tier.
        </p>

        <div className="grid grid-flow-row gap-6 bg-paper border border-divider rounded-lg p-8 max-w-2xl w-full">
          <p className="text-base font-medium text-center">Join thousands of developers shipping faster with Nhost</p>
          
          <div className="grid grid-flow-row items-center gap-4 pt-2 md:grid-flow-col md:gap-6">
            <Button
              className="text-base shadow-lg hover:shadow-xl transition-all duration-300"
              href="https://app.nhost.io"
              target="_blank"
              rel="noopener noreferrer"
            >
              Start for free <ArrowRightIcon />
            </Button>
            <Button
              variant="outlined"
              className="text-base"
              href="https://calendly.com/nhost/demo"
              target="_blank"
              rel="noopener noreferrer"
            >
              Book a demo
            </Button>
            <p className="text-base font-medium">
              Questions? <Link href="mailto:hello@nhost.io">Talk to us</Link>
            </p>
          </div>
        </div>
      </div>
    </Container>
  )
}
