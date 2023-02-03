import { Button, ButtonProps } from '@/components/common/Button'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
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

function ExampleSelectorButton({
  active,
  className,
  ...props
}: ButtonProps & { active?: boolean }) {
  return (
    <div
      className={twMerge(
        'relative',
        active &&
          'before:absolute before:bottom-0 before:left-0 before:right-0 before:top-0 before:z-0 before:skew-y-3 before:rounded-md before:bg-brand-main before:bg-opacity-50 before:blur-xl before:motion-safe:transition-all',
      )}
    >
      <Button
        variant={active ? 'outlined' : 'borderless'}
        size="sm"
        className={twMerge(
          'relative z-10 border-0 hover:bg-black hover:bg-opacity-100 md:border',
          'px-0 md:px-2 xl:px-4',
          'text-xs md:text-sm',
          'rounded-none md:rounded-md',
          !active
            ? 'text-opacity-65'
            : 'border-b border-b-white md:border-b-divider',
        )}
        {...props}
      />
    </div>
  )
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
      className="mt-24 grid grid-flow-row gap-14 overflow-hidden pb-8 lg:mt-32 xl:overflow-visible"
    >
      <div className="z-10 grid grid-flow-row justify-center gap-10">
        <SectionHeading
          title={
            <>
              Built by developers,
              <br />
              for developers
            </>
          }
          subtitle="What used to take months, now takes minutes."
        />
      </div>

      <div className="z-0 grid items-center gap-6 xl:grid-cols-2">
        <div className="col-span-1 hidden xl:order-1 xl:block">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
          >
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-2 col-span-1 mx-auto hidden w-full max-w-screen-sm md:block xl:hidden">
          <CodeSnippet
            language={codeSnippetLanguageMap[activeTechnology]}
            wrapLongLines={false}
            customStyle={{ padding: 24 }}
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

        <div className="order-1 col-span-1 grid grid-flow-row content-start gap-18 lg:gap-24 xl:order-2 xl:pt-16">
          <div className="relative z-10 flex w-full flex-row justify-between md:justify-center md:gap-6">
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

          <div className="z-10 flex w-full flex-row justify-between md:justify-center md:gap-6">
            <TechnologySelectorButton
              active={activeTechnology === 'javascript'}
              onClick={() => setActiveTechnology('javascript')}
            >
              <JavaScriptIcon /> JavaScript
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
              active={activeTechnology === 'vue'}
              onClick={() => setActiveTechnology('vue')}
            >
              <VueIcon /> Vue
            </TechnologySelectorButton>

            <TechnologySelectorButton
              active={activeTechnology === 'flutter'}
              onClick={() => setActiveTechnology('flutter')}
            >
              <FlutterIcon /> Flutter
            </TechnologySelectorButton>
          </div>

          <div className="z-0 hidden h-56 w-full flex-row justify-center xl:flex xl:-translate-y-full">
            <div className="absolute max-w-[470px]">
              <Image
                src="/common/logo-badge.svg"
                width={1220}
                height={1220}
                alt="Nhost Logo in a dark circle"
              />
            </div>
          </div>
        </div>
      </div>
    </Container>
  )
}
