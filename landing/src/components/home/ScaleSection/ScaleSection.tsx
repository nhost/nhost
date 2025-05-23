import { Card } from '@/components/common/Card'
import { Container } from '@/components/common/Container'
import { SectionHeading } from '@/components/common/SectionHeading'

export default function ScaleSection() {
  return (
    <>
      <Container
        component="section"
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        className="grid grid-flow-row gap-14"
      >
        <SectionHeading
          title="Launch in minutes, scale without limits."
          subtitle="From your first prototype to millions of users, Nhost is built to scale with you."
        />
        <div className="mx-auto mt-8 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                Production ready from day one
              </h3>

              <p className="text-base text-white text-opacity-65">
                Nhost scales with you.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7">
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">CI/CD pipelines</h3>

              <p className="text-base text-white text-opacity-65">
                Deploy your app with a single git push.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">Built-in observability</h3>

              <p className="text-base text-white text-opacity-65">
                Monitor your app&apos;s performance and get insights into your
                users.
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8">
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
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
