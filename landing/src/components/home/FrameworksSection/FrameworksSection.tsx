import { Button, ButtonProps } from '@/components/common/Button'
import { Container } from '@/components/common/Container'
import { DartIcon } from '@/components/common/icons/DartIcon'
import { JavaScriptIcon } from '@/components/common/icons/JavaScriptIcon'
import { NextjsIcon } from '@/components/common/icons/NextjsIcon'
import { ReactIcon } from '@/components/common/icons/ReactIcon'
import { ReactNativeIcon } from '@/components/common/icons/ReactNativeIcon'
import { SvelteIcon } from '@/components/common/icons/SvelteIcon'
import { VueIcon } from '@/components/common/icons/VueIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { twMerge } from 'tailwind-merge'

function FrameworkSelectorButton({
  className,
  ...props
}: ButtonProps & { active?: boolean }) {
  return (
    <Button
      variant="borderless"
      size="sm"
      className={twMerge(
        'group aspect-square w-16 shrink-0 place-items-center justify-center p-0 hover:bg-transparent md:w-20',
        'border-0 md:border',
        'text-xs md:text-sm',
        'text-opacity-65 hover:text-opacity-100',
        'hover:border hover:border-divider hover:bg-white hover:bg-opacity-10 hover:text-white hover:text-opacity-100',
        className,
      )}
      {...props}
    />
  )
}

export default function FrameworksSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'pt-14 z-30 relative' } }}
      className="grid grid-flow-row gap-12 pb-12 lg:gap-28"
    >
      <SectionHeading title="Build faster with our SDK" />

      <div className="mx-auto max-w-2xl">
        <div className="grid w-full grid-cols-2 justify-items-center gap-6 md:grid-cols-4 md:gap-8 lg:grid-cols-8 lg:gap-10">
          <FrameworkSelectorButton
            href="https://docs.nhost.io/reference/javascript/nhost-js/main"
            target="_blank"
            rel="noreferrer"
          >
            <JavaScriptIcon className="h-12 w-12 text-[#F7DF1E] grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/getting-started/quickstart/react"
            target="_blank"
            rel="noreferrer"
          >
            <ReactIcon className="h-12 w-12 text-[#61DAFB] grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/getting-started/quickstart/vue"
            target="_blank"
            rel="noreferrer"
          >
            <VueIcon className="h-11 w-11 grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/getting-started/quickstart/nextjs"
            target="_blank"
            rel="noreferrer"
          >
            <NextjsIcon className="h-16 w-16 fill-white grayscale saturate-0 filter transition duration-200 group-hover:text-white group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/getting-started/quickstart/sveltekit"
            target="_blank"
            rel="noreferrer"
          >
            <SvelteIcon className="h-12 w-12 grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/getting-started/quickstart/reactnative"
            target="_blank"
            rel="noreferrer"
          >
            <ReactNativeIcon className="h-12 w-12 text-[#61DAFB] grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://github.com/nhost/nhost-dart"
            target="_blank"
            rel="noreferrer"
          >
            <DartIcon className="h-11 w-11 grayscale saturate-0 filter transition duration-200 group-hover:grayscale-0 group-hover:saturate-100" />
          </FrameworkSelectorButton>

          <FrameworkSelectorButton
            href="https://docs.nhost.io/reference/auth/"
            target="_blank"
            rel="noreferrer"
          >
            <div className="flex h-12 w-12 items-center justify-center text-xl">
              APIs
            </div>
          </FrameworkSelectorButton>
        </div>
      </div>
    </Container>
  )
}
