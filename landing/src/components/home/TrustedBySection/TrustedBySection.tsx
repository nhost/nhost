import { Container } from '@/components/common/Container'
import Image from 'next/image'

export default function TrustedBySection() {
  return (
    <>
      <Container
        component="section"
        slotProps={{ root: { className: 'pt-14 z-30 relative' } }}
        className="grid grid-flow-row justify-center gap-12 text-center"
      >
        <h2 className="text-base text-white text-opacity-65">
          Trusted by developers at
        </h2>

        <div className="flex flex-row flex-wrap items-center justify-center gap-x-6 gap-y-6 lg:gap-x-12 lg:gap-y-8">
          <Image
            src="/customers/celsia.svg"
            alt="Celsia Logo"
            width={140}
            height={40}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-flow.svg"
            alt="React Flow Logo"
            width={168}
            height={41}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/midnight-society.png"
            alt="Midnight Society Logo"
            width={136}
            height={42}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/revtron.svg"
            alt="RevTron Logo"
            width={163}
            height={24}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/slides-with-friends.svg"
            alt="Slides with friends Logo"
            width={142}
            height={64}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />

          <Image
            src="/customers/react-play.svg"
            alt="React Play Logo"
            width={153}
            height={55}
            className="grayscale transition-all duration-500 hover:grayscale-0"
          />
        </div>
      </Container>
    </>
  )
}
