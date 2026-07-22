import { Card } from '@/components/common/Card'
import { Container } from '@/components/common/Container'
import { SectionHeading } from '@/components/common/SectionHeading'

export default function ScaleSection() {
  return (
    <>
      <Container
        component="section"
        slotProps={{ root: { className: 'pt-14 z-30 relative' } }}
        className="grid grid-flow-row gap-14"
      >
        <SectionHeading
          title="Built for production, designed to scale."
          subtitle="From your first prototype to millions of users, Nhost is built to scale with you."
        />
        <div className="mx-auto mt-8 grid max-w-2xl grid-cols-1 gap-6 sm:grid-cols-2 lg:max-w-4xl">
          <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">
                Production ready from day one
              </h3>

              <p className="text-base text-white text-opacity-65">
                Nhost scales with you.
              </p>
            </div>
          </Card>
          <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">CI/CD pipelines</h3>

              <p className="text-base text-white text-opacity-65">
                Deploy your app with a single git push.
              </p>
            </div>
          </Card>
          <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">Built-in observability</h3>

              <p className="text-base text-white text-opacity-65">
                Monitor your app&apos;s performance and get insights into your
                users.
              </p>
            </div>
          </Card>
          <Card className="flex flex-col items-center justify-center gap-4 p-8 text-center">
            <div className="space-y-3">
              <h3 className="text-lg font-bold">
                Modern developer experience
              </h3>

              <p className="text-base text-white text-opacity-65">
                CLI for local development, Dashboard for managing your app, and
                more.
              </p>
            </div>
          </Card>
        </div>
      </Container>
    </>
  )
}
