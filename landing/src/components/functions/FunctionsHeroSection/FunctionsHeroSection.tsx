import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { ProductIcon } from '@/components/common/ProductIcon'
import { SectionHeading } from '@/components/common/SectionHeading'
import Image from 'next/image'

const heroExample = `export default (req: Request, res: Response) => {
  res.status(200).send('Hello world')
}`

export default function FunctionsHeroSection() {
  return (
    <Container
      component="section"
      slotProps={{ root: { className: 'overflow-visible' } }}
      className="relative grid grid-cols-1 items-center gap-14 pt-16 sm:gap-6 md:grid-cols-2 md:pt-42"
    >
      <div className="relative z-10 grid grid-flow-row content-center justify-start justify-items-start gap-4 lg:px-20">
        <ProductIcon>
          <Image
            src="/products/functions.svg"
            width={24}
            height={24}
            alt="A user"
            priority
          />
        </ProductIcon>

        <SectionHeading
          title="Functions"
          subtitle="Server-side code that works as API endpoints with global scale."
          className="text-left"
          slotProps={{
            title: {
              component: 'h1',
              className: 'font-semibold',
            },
            subtitle: {
              className: 'text-base !leading-normal',
            },
          }}
        />
      </div>

      <div>
        <CodeSnippet language="typescript">{heroExample}</CodeSnippet>
      </div>
    </Container>
  )
}
