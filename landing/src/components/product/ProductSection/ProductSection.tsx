import { Container, ContainerProps } from '@/components/common/Container'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import DatabaseVisual from '@/components/product/icons/DatabaseVisual'
import GraphQLVisual from '@/components/product/icons/GraphQLVisual'
import AuthVisual from '@/components/product/icons/AuthVisual'
import StorageVisual from '@/components/product/icons/StorageVisual'
import FunctionsVisual from '@/components/product/icons/FunctionsVisual'
import RunVisual from '@/components/product/icons/RunVisual'
import AIVisual from '@/components/product/icons/AIVisual'

interface NhostService {
  id: string
  title: string
  description: string
  href: string
  visualElement: ReactNode
  gridClasses: string
  group: 'Core' | 'Extend' | 'Enhance'
}

const nhostServices: NhostService[] = [
  {
    id: 'database',
    title: 'Postgres database',
    description: 'Enterprise-grade SQL database, instantly ready.',
    href: '/product/database',
    visualElement: <DatabaseVisual />,
    gridClasses:
      'sm:col-span-2 md:col-span-2 lg:col-span-2 sm:row-span-2 md:row-span-2 lg:row-span-2 bg-paper/20',
    group: 'Core',
  },
  {
    id: 'graphql',
    title: 'GraphQL API',
    description: 'Instant, real-time API for your data.',
    href: '/product/graphql',
    visualElement: <GraphQLVisual />,
    gridClasses:
      'sm:col-span-1 md:col-span-1 lg:col-span-1 sm:row-span-2 md:row-span-2 lg:row-span-2 bg-paper/20',
    group: 'Core',
  },
  {
    id: 'auth',
    title: 'Authentication',
    description: 'Secure user sign-up, sign-in, & management.',
    href: '/product/auth',
    visualElement: <AuthVisual />,
    gridClasses: 'sm:col-span-1 md:col-span-1 lg:col-span-1 bg-paper/20',
    group: 'Core',
  },
  {
    id: 'storage',
    title: 'Storage',
    description: 'File uploads, downloads, & CDN.',
    href: '/product/storage',
    visualElement: <StorageVisual />,
    gridClasses: 'sm:col-span-1 md:col-span-1 lg:col-span-1 bg-paper/20',
    group: 'Core',
  },
  {
    id: 'functions',
    title: 'Serverless Functions',
    description: 'Scalable JS/TS backend logic. No servers.',
    href: '/product/functions',
    visualElement: <FunctionsVisual />,
    gridClasses: 'sm:col-span-1 md:col-span-1 lg:col-span-1 bg-paper/40',
    group: 'Extend',
  },
  {
    id: 'run',
    title: 'Bring your own containers',
    description: 'Deploy your services written in any language.',
    href: '/product/run',
    visualElement: <RunVisual />,
    gridClasses: 'sm:col-span-1 md:col-span-1 lg:col-span-1 bg-paper/40',
    group: 'Extend',
  },
  {
    id: 'ai',
    title: 'AI toolkit',
    description: 'Auto-Embeddings, Assistants, File Stores, and more.',
    href: '/product/ai',
    visualElement: <AIVisual />,
    gridClasses: 'sm:col-span-2 md:col-span-2 lg:col-span-2 bg-paper/40',
    group: 'Enhance',
  },
]

export interface ProductSectionProps extends ContainerProps {
  heading?: ReactNode
  disabledLink?: string
}

export default function ProductSection({
  heading,
  className,
  disabledLink,
  ...props
}: ProductSectionProps) {
  return (
    <Container
      component="section"
      className="grid grid-flow-row gap-14"
      {...props}
    >
      {heading}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 md:gap-5 lg:grid-cols-4">
        {nhostServices.map((service) => (
          <a
            key={service.id}
            href={service.href}
            className={twMerge(
              'group relative flex flex-col justify-between overflow-hidden rounded-xl p-4 transition-all duration-300 ease-in-out focus:outline-none md:p-5',
              'border border-divider',
              'hover:shadow-xl dark:hover:shadow-brand-dark/30',
              'hover:border-brand-main/20',
              'shadow-md',
              service.gridClasses,
              disabledLink === service.id && 'pointer-events-none opacity-65',
            )}
          >
            <div className="flex-shrink-0">
              <h3 className="font-mona text-lg font-semibold text-default dark:text-gray-100">
                {service.title}
              </h3>
              <p className="mt-1 text-sm leading-relaxed text-gray-500 dark:text-gray-400">
                {service.description}
              </p>
            </div>

            <div className="mt-4 flex flex-grow items-center justify-center">
              {service.visualElement}
            </div>
          </a>
        ))}
      </div>
    </Container>
  )
}
