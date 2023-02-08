import { Button, ButtonProps } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { FlutterIcon } from '@/components/common/icons/FlutterIcon'
import { JavaScriptIcon } from '@/components/common/icons/JavaScriptIcon'
import { NextjsIcon } from '@/components/common/icons/NextjsIcon'
import { ReactIcon } from '@/components/common/icons/ReactIcon'
import { VueIcon } from '@/components/common/icons/VueIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import { codeSnippets, Snippets, TechSnippets } from '@/data/codeSnippets'
import Image from 'next/image'
import { useState } from 'react'
import { twMerge } from 'tailwind-merge'

const codeSnippetLanguageMap: Record<keyof TechSnippets, string> = {
  javascript: 'javascript',
  react: 'tsx',
  nextjs: 'tsx',
  vue: 'tsx',
  flutter: 'dart',
}

function TechnologySelectorButton({
  active,
  className,
  ...props
}: ButtonProps & { active?: boolean }) {
  return (
    <Button
      variant={active ? 'outlined' : 'borderless'}
      size="sm"
      className={twMerge(
        'justify-items-center hover:bg-transparent',
        'grid-flow-row md:grid-flow-col',
        'border-0 md:border',
        'px-0 py-0 md:px-4 md:py-2',
        'text-xs md:text-sm',
        !active && 'text-opacity-65',
      )}
      {...props}
    />
  )
}

export default function ExamplesSection() {
  const [activeExample, setActiveExample] = useState<keyof Snippets>('signUp')
  const [activeTechnology, setActiveTechnology] =
    useState<keyof TechSnippets>('javascript')

  const activeSnippet = codeSnippets[activeTechnology][activeExample] || ''

  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-hidden xl:overflow-visible' } }}
      className="mt-24 grid grid-flow-row gap-14 pb-8 lg:mt-32"
    >
      <div className="z-10 grid grid-flow-row justify-center gap-10">
        <SectionHeading
          title={<>For Developers - By Developers</>}
          subtitle="Build products faster using our SDKs"
        />
      </div>

      <div className="z-0 grid items-start gap-14 xl:grid-cols-2 xl:gap-6">
        <div className="order-2 col-span-1 mx-auto hidden w-full max-w-screen-sm md:block xl:order-1 xl:max-w-none">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
            slotProps={{ root: { className: 'mx-auto md:max-w-xl' } }}
          >
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-2 col-span-1 block md:hidden">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
            customStyle={{ width: 'calc(100vw - 40px)', padding: 16 }}
          >
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-1 col-span-1 mx-auto grid max-w-2xl grid-flow-row content-start xl:order-2 xl:max-w-none">
          <div className="relative z-20 flex w-full flex-row justify-evenly gap-2 xl:justify-center xl:gap-6">
            <ExampleSelectorButton
              active={activeExample === 'signUp'}
              onClick={() => setActiveExample('signUp')}
            >
              Sign Up
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'query'}
              onClick={() => setActiveExample('query')}
            >
              GraphQL Query
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'mutation'}
              onClick={() => setActiveExample('mutation')}
            >
              GraphQL Mutation
            </ExampleSelectorButton>

            <ExampleSelectorButton
              active={activeExample === 'fileUpload'}
              onClick={() => setActiveExample('fileUpload')}
            >
              File Upload
            </ExampleSelectorButton>
          </div>

          <Image
            src="/common/connectors/top-connectors.svg"
            width={587}
            height={96}
            alt="Dashed lines"
            className="z-0 mx-auto h-auto w-full"
          />

          <div className="relative z-20 flex w-full flex-row justify-around md:justify-center md:gap-6">
            <TechnologySelectorButton
              active={activeTechnology === 'javascript'}
              onClick={() => setActiveTechnology('javascript')}
            >
              <JavaScriptIcon /> JavaScript
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'vue'}
              onClick={() => setActiveTechnology('vue')}
            >
              <VueIcon /> Vue
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'react'}
              onClick={() => setActiveTechnology('react')}
            >
              <ReactIcon /> React
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'nextjs'}
              onClick={() => setActiveTechnology('nextjs')}
            >
              <NextjsIcon /> Next.js
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'flutter'}
              onClick={() => setActiveTechnology('flutter')}
            >
              <FlutterIcon /> Flutter
            </TechnologySelectorButton>
          </div>

          <div className="relative z-0">
            {activeTechnology === 'javascript' && (
              <div className="bottom-connector-first-active absolute z-10 hidden h-full w-full">
                <div className="bg-pipe-gradient absolute h-full w-full rotate-45 transform animate-translate-top-bottom"></div>
              </div>
            )}

            <Image
              src="/common/connectors/bottom-connectors.svg"
              width={587}
              height={65}
              alt="Dashed lines"
              className="mx-auto hidden h-auto w-full xl:block"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute top-11 left-0 right-0 z-0 mx-auto -mt-28 hidden h-auto w-full max-w-[280px] object-none xl:block"
            />
          </div>
        </div>
      </div>
    </Container>
  )
}
