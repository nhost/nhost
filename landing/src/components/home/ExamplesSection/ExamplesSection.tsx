import { Button } from '@/components/common/Button'
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

export default function ExamplesSection() {
  const [activeExample, setActiveExample] = useState<keyof Snippets>('signUp')
  const [activeTechnology, setActiveTechnology] =
    useState<keyof TechSnippets>('javascript')

  const activeSnippet = codeSnippets[activeTechnology][activeExample] || ''

  return (
    <Container
      component="section"
      className="mt-24 grid grid-flow-row gap-14 lg:mt-40"
    >
      <div className="grid grid-flow-row justify-center gap-10">
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

      <div className="grid items-center gap-6 xl:grid-cols-2">
        <div className="order-2 col-span-1 xl:order-1">
          <CodeSnippet language={codeSnippetLanguageMap[activeTechnology]}>
            {activeSnippet}
          </CodeSnippet>
        </div>

        <div className="order-1 col-span-1 grid grid-flow-row content-start gap-24 xl:order-2 xl:pt-16">
          <div className="relative z-10 flex w-full flex-row justify-center gap-6">
            <Button
              variant={activeExample === 'signUp' ? 'outlined' : 'borderless'}
              size="sm"
              className={twMerge(
                'bg-default',
                activeExample !== 'signUp' && 'text-opacity-65',
              )}
              onClick={() => setActiveExample('signUp')}
            >
              Sign Up
            </Button>

            <Button
              variant={activeExample === 'query' ? 'outlined' : 'borderless'}
              size="sm"
              className={twMerge(
                'bg-default',
                activeExample !== 'query' && 'text-opacity-65',
              )}
              onClick={() => setActiveExample('query')}
            >
              GraphQL Query
            </Button>

            <Button
              variant={activeExample === 'mutation' ? 'outlined' : 'borderless'}
              size="sm"
              className={twMerge(
                'bg-default',
                activeExample !== 'mutation' && 'text-opacity-65',
              )}
              onClick={() => setActiveExample('mutation')}
            >
              GraphQL Mutation
            </Button>

            <Button
              variant={
                activeExample === 'fileUpload' ? 'outlined' : 'borderless'
              }
              size="sm"
              className={twMerge(
                'bg-default',
                activeExample !== 'fileUpload' && 'text-opacity-65',
              )}
              onClick={() => setActiveExample('fileUpload')}
            >
              File Upload
            </Button>
          </div>

          <div className="z-10 flex w-full flex-row justify-center gap-6">
            <Button
              variant={
                activeTechnology === 'javascript' ? 'outlined' : 'borderless'
              }
              size="sm"
              className={twMerge(
                'bg-default',
                activeTechnology !== 'javascript' && 'text-opacity-65',
              )}
              onClick={() => setActiveTechnology('javascript')}
            >
              <JavaScriptIcon /> JavaScript
            </Button>

            <Button
              variant={activeTechnology === 'vue' ? 'outlined' : 'borderless'}
              size="sm"
              className={twMerge(
                'bg-default',
                activeTechnology !== 'vue' && 'text-opacity-65',
              )}
              onClick={() => setActiveTechnology('vue')}
            >
              <VueIcon /> Vue
            </Button>

            <Button
              variant={activeTechnology === 'react' ? 'outlined' : 'borderless'}
              size="sm"
              className={twMerge(
                'bg-default',
                activeTechnology !== 'react' && 'text-opacity-65',
              )}
              onClick={() => setActiveTechnology('react')}
            >
              <ReactIcon /> React
            </Button>

            <Button
              variant={
                activeTechnology === 'nextjs' ? 'outlined' : 'borderless'
              }
              size="sm"
              className={twMerge(
                'bg-default',
                activeTechnology !== 'nextjs' && 'text-opacity-65',
              )}
              onClick={() => setActiveTechnology('nextjs')}
            >
              <NextjsIcon /> Next.js
            </Button>

            <Button
              variant={
                activeTechnology === 'flutter' ? 'outlined' : 'borderless'
              }
              size="sm"
              className={twMerge(
                'bg-default',
                activeTechnology !== 'flutter' && 'text-opacity-65',
              )}
              onClick={() => setActiveTechnology('flutter')}
            >
              <FlutterIcon /> Flutter
            </Button>
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
