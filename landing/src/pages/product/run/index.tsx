import { Button } from '@/components/common/Button'
import { Card } from '@/components/common/Card'
import { CodeSnippet } from '@/components/common/CodeSnippet'
import { Container } from '@/components/common/Container'
import { CTASection } from '@/components/common/CTASection'
import { ExampleSelectorButton } from '@/components/common/ExampleSelectorButton'
import { Glow } from '@/components/common/Glow'
import { ArrowRightIcon } from '@/components/common/icons/ArrowRightIcon'
import { Layout } from '@/components/common/Layout'
import { LineGrid } from '@/components/common/LineGrid'
import { SectionHeading } from '@/components/common/SectionHeading'
import { ProductSection } from '@/components/product/ProductSection'
import { RunHeroSection } from '@/components/run/RunHeroSection'
import Image from 'next/image'
import Link from 'next/link'
import { ReactElement, useState } from 'react'

const codeSnippets = {
  'nhost-service.toml': {
    snippet: `name = 'cat-generator'

[image]
image = 'nhost/cat-generator:0.0.1'

[[ports]]
port = 5000
type = 'http'
publish = true

[resources]
replicas = 2

[resources.compute]
cpu = 2000
memory = 4096`,
    lang: 'javascript',
  },
  Dockerfile: {
    snippet: `# Start with a base image containing Python runtime
FROM python:3.9-slim-buster

# Set the working directory in the container
WORKDIR /app

# Add the requirements file to the container
ADD requirements.txt .

# Install any needed packages specified in requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# Copy the current directory contents into the container at /app
COPY . /app

# Make port 5000 available to the world outside this container
EXPOSE 5000

# Run the application when the container launches
CMD ["python", "cat-generator.py"]`,
    lang: 'docker',
  },
  'cat-generator.py': {
    snippet: `
from flask import Flask, send_file
import requests
from io import BytesIO

app = Flask(__name__)

@app.route('/cat')
def generate_cat_picture():
    response = requests.get('https://api.thecatapi.com/v1/images/search')
    image_url = response.json()[0]['url']

    # Get the image content
    image_content = requests.get(image_url).content

    # Send the image file
    return send_file(BytesIO(image_content), mimetype='image/jpeg')

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000)`,
    lang: 'python',
  },
}

export default function NhostRunPage() {
  const [selectedExample, setSelectedExample] =
    useState<keyof typeof codeSnippets>('nhost-service.toml')

  return (
    <>
      <RunHeroSection />

      <Container
        component="section"
        className="mt-16 grid grid-flow-row gap-16 md:mt-32 md:gap-24"
        slotProps={{
          root: { className: 'overflow-hidden xl:overflow-visible' },
        }}
      >
        <div className="grid grid-flow-row justify-items-center gap-8">
          <div className="gradient-background rounded-full p-px mb-6 animate-fade-in">
            <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
              Any container, any language
            </p>
          </div>
          <SectionHeading
            title={
              <>
                Extend your backend <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">seamlessly</span>
              </>
            }
            subtitle="Build and Run services written in your favourite language with zero configuration"
            className="max-w-xl"
            slotProps={{
              subtitle: {
                className: 'max-w-xl mx-auto',
              },
            }}
          />

          <Button
            variant="borderless"
            className="text-base font-bold animate-fade-in"
            size="sm"
            href="https://docs.nhost.io/products/run/overview"
            rel="noopener noreferrer"
            target="_blank"
          >
            Explore the docs <ArrowRightIcon />
          </Button>
        </div>

        <div className="grid grid-cols-1 items-start justify-items-center gap-0 pb-12 xl:grid-cols-2 xl:justify-items-start xl:gap-6">
          <div className="order-2 w-full xl:order-1">
            <CodeSnippet
              language={codeSnippets[selectedExample].lang}
              customStyle={{ minHeight: 220 }}
              slotProps={{ root: { className: 'mx-auto md:max-w-xl animate-fade-in' } }}
            >
              {codeSnippets[selectedExample].snippet}
            </CodeSnippet>
          </div>

          <div className="relative order-1 w-full max-w-3xl xl:order-2">
            <div className="relative z-10 grid grid-flow-col justify-around xl:justify-evenly">
              <ExampleSelectorButton
                active={selectedExample === 'nhost-service.toml'}
                onClick={() => setSelectedExample('nhost-service.toml')}
              >
                nhost-service.toml
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'Dockerfile'}
                onClick={() => setSelectedExample('Dockerfile')}
              >
                Dockerfile
              </ExampleSelectorButton>

              <ExampleSelectorButton
                active={selectedExample === 'cat-generator.py'}
                onClick={() => setSelectedExample('cat-generator.py')}
              >
                cat-generator.py
              </ExampleSelectorButton>
            </div>

            <Image
              src="/common/connectors/run-example-connectors.svg"
              alt="Dashed lines"
              width={608}
              height={97}
              className="h-auto w-full animate-fade-in"
            />

            <Image
              src="/common/logo-glow.svg"
              width={1220}
              height={1220}
              alt="Nhost Logo in a dark circle"
              className="absolute -top-32 left-0 right-0 z-0 mx-auto hidden h-auto w-full object-none xl:block animate-pulse"
            />
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background rounded-full p-px mb-6 mx-auto w-fit animate-fade-in">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Endless possibilities
          </p>
        </div>
        <SectionHeading
          title={
            <>
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Use cases</span> for every need
            </>
          }
          subtitle="Nhost Run allows you to expand and truly customize your backend in multiple ways"
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-4 md:grid-cols-2">
          <Card className="flex flex-col space-y-3 transition-all hover:shadow-glow-sm">
            <Image
              src="/products/run-cloud.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Custom</span> Backend
            </h3>
            <p className="text-base text-white text-opacity-65">
              Deploy and execute your custom backend services within your
              project environment with zero configuration.
            </p>
          </Card>

          <Card className="flex flex-col space-y-3 transition-all hover:shadow-glow-sm">
            <Image
              src="/products/run-workloads.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Data-Processing</span> Workloads
            </h3>
            <p className="text-base text-white text-opacity-65">
              Execute data-processing tasks in close proximity to your database
              for enhanced efficiency and minimal latency.
            </p>
          </Card>

          <Card className="flex flex-col space-y-3 transition-all hover:shadow-glow-sm">
            <Image
              src="/products/run-graphql.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">GraphQL API</span> Extensions
            </h3>
            <p className="text-base text-white text-opacity-65">
              Extend your GraphQL API by incorporating remote schemas or
              actions that seamlessly integrate with your existing API.
            </p>
          </Card>

          <Card className="flex flex-col space-y-3 transition-all hover:shadow-glow-sm">
            <Image
              src="/products/run-oss.svg"
              width={24}
              height={24}
              alt="Globe"
            />
            <h3 className="text-base font-bold">
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">OSS</span> and third-party software
            </h3>
            <p className="text-base text-white text-opacity-65">
              Run services like Redis, Memcached, Datadog Agents and MongoDB alongside
              your Nhost stack for a complete backend solution.
            </p>
          </Card>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background rounded-full p-px mb-6 mx-auto w-fit animate-fade-in">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Built for performance
          </p>
        </div>
        <SectionHeading
          title={
            <>
              Key <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">advantages</span> of Run
            </>
          }
          subtitle="Nhost Run offers several key advantages by running workloads alongside your project"
          className="max-w-xl"
          slotProps={{
            subtitle: {
              className: 'max-w-xl mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-24 grid max-w-4xl grid-cols-1 gap-8 md:grid-cols-2">
          <div className="flex flex-row items-start space-x-4 group hover:transform hover:translate-y-[-4px] transition-all">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Minimal</span> Latency
              </h3>
              <p className="text-base text-white text-opacity-65">
                Communication and data exchange between different components of
                your project occur quickly and efficiently, providing a seamless user experience.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4 group hover:transform hover:translate-y-[-4px] transition-all">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">No</span> Egress Costs
              </h3>
              <p className="text-base text-white text-opacity-65">
                No additional egress costs for transferring data between
                different components of your project, saving you money as your application scales.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4 group hover:transform hover:translate-y-[-4px] transition-all">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Improved</span> Reliability
              </h3>
              <p className="text-base text-white text-opacity-65">
                Your workloads continue to function even in scenarios where
                internet access may be limited or disrupted, enhancing overall system resilience.
              </p>
            </div>
          </div>

          <div className="flex flex-row items-start space-x-4 group hover:transform hover:translate-y-[-4px] transition-all">
            <Image
              src="/products/tick.svg"
              width={32}
              height={32}
              className="-mt-1 transition-all group-hover:scale-110"
              alt="Check"
            />
            <div className="flex flex-col space-y-2">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Integrated</span> Operations
              </h3>
              <p className="text-base text-white text-opacity-65">
                Develop, build, manage, and scale your own workloads the same
                way that you manage your Nhost Project, providing a unified workflow.
              </p>
            </div>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24 lg:mt-40">
        <div className="gradient-background rounded-full p-px mb-6 mx-auto w-fit animate-fade-in">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Easy deployment
          </p>
        </div>
        <SectionHeading
          title={
            <>
              <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Simple</span> configuration, powerful results
            </>
          }
          subtitle="Deploy your containerized applications in minutes with a straightforward configuration file"
          className="max-w-2xl"
          slotProps={{
            subtitle: {
              className: 'max-w-lg mx-auto',
            },
          }}
        />

        <div className="mx-auto mt-16 grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl">
          <div className="rounded-xl border border-divider bg-paper p-6 animate-fade-in">
            <h3 className="text-xl font-bold mb-4">Define your service with <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">nhost-service.toml</span></h3>
            <p className="text-base text-white text-opacity-65 mb-6">
              Create a simple configuration file to define your service requirements:
            </p>
            <CodeSnippet language="toml" disableGlow>
{`name = 'my-custom-service'

[image]
image = 'my-org/my-service:latest'

[[ports]]
port = 8080
type = 'http'
publish = true

[resources]
replicas = 2

[resources.compute]
cpu = 1000
memory = 2048`}
            </CodeSnippet>
          </div>
          
          <div className="rounded-xl border border-divider bg-paper p-6 animate-fade-in-delay">
            <h3 className="text-xl font-bold mb-4">Deploy with the <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Nhost CLI</span></h3>
            <p className="text-base text-white text-opacity-65 mb-6">
              Push your service directly from your local environment:
            </p>
            <CodeSnippet language="bash" disableGlow>
{`# Build your Docker image
docker build -t my-org/my-service:latest .

# Deploy to Nhost Run
nhost run deploy

# Check service status
nhost run status my-custom-service`}
            </CodeSnippet>
            <p className="text-base text-white text-opacity-65 mt-6">
              Your service is now running alongside your Nhost stack!
            </p>
          </div>
        </div>
      </Container>

      <Container component="section" className="mt-24">
        <div className="gradient-background rounded-full p-px mb-6 mx-auto w-fit animate-fade-in">
          <p className="rounded-full bg-paper px-4.5 py-1.5 text-sm">
            Comprehensive features
          </p>
        </div>
        <SectionHeading 
          title={
            <>
              And <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">more</span>...
            </>
          } 
          className="max-w-lg" 
        />

        <div className="mx-auto mt-16 grid max-w-xs grid-cols-1 content-start justify-start gap-6 sm:max-w-2xl sm:auto-rows-fr sm:grid-cols-2 lg:max-w-5xl lg:grid-cols-3">
          <Card className="relative grid grid-flow-row place-content-center place-items-center gap-4 sm:row-span-15 transition-all hover:shadow-glow-sm">
            <div className="relative">
              <LineGrid className="object-top-left left-1/2 top-1/2 mx-auto h-40 w-40 -translate-x-1/2 -translate-y-1/2" />
              <Glow className="animate-pulse" />
              <Image
                src="/common/logo-circle.svg"
                width={100}
                height={100}
                alt="Nhost Logo in a dark circle"
                className="relative z-10 h-26 w-26"
              />
            </div>

            <SectionHeading
              title="Nhost"
              subtitle="Build apps users love"
              slotProps={{ title: { component: 'h3' } }}
            />

            <Button href="https://app.nhost.io" className="mt-6 animate-fade-in">
              Start building <ArrowRightIcon />
            </Button>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 transition-all hover:shadow-glow-sm group">
            <Image
              src="/products/globe.svg"
              width={24}
              height={24}
              alt="Globe"
              className="mx-auto group-hover:scale-110 transition-all"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Private</span> Registry
              </h3>

              <p className="text-base text-white text-opacity-65">
                Push your service images to our private registry with
                deployments or using our CLI for a streamlined workflow
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-7 transition-all hover:shadow-glow-sm group">
            <Image
              src="/products/code.svg"
              width={24}
              height={24}
              alt="Resize icon"
              className="mx-auto group-hover:scale-110 transition-all"
            />
            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Polyglot</span> Development
              </h3>

              <p className="text-base text-white text-opacity-65">
                Run services written in JavaScript/TypeScript, Go, Python, Rust, or any other language 
                that can be containerized
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 transition-all hover:shadow-glow-sm group">
            <Image
              src="/products/maximize.svg"
              width={24}
              height={24}
              alt="Full screen icon"
              className="mx-auto group-hover:scale-110 transition-all"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">High</span> Scalability
              </h3>

              <p className="text-base text-white text-opacity-65">
                Use Dedicated Compute and Service Replicas to scale your custom
                Services for handling increased load with ease
              </p>
            </div>
          </Card>
          <Card className="grid grid-flow-row place-content-center place-items-center gap-4 text-center sm:row-span-8 lg:row-span-7 transition-all hover:shadow-glow-sm group">
            <Image
              src="/products/arrows-clockwise.svg"
              width={24}
              height={24}
              alt="A box"
              className="mx-auto group-hover:scale-110 transition-all"
            />

            <div className="grid grid-flow-row gap-2.5">
              <h3 className="text-base font-bold">
                <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">Integrated</span> CI
              </h3>

              <p className="text-base text-white text-opacity-65">
                Streamlined continuous integration coming soon to make your 
                deployment workflow even more efficient
              </p>
            </div>
          </Card>
        </div>
      </Container>

      <ProductSection
        slotProps={{ root: { className: 'mt-24 lg:mt-40' } }}
        heading={
          <div className="grid grid-flow-row items-center justify-items-center gap-4">
            <div className="gradient-background rounded-full p-px animate-fade-in">
              <p className="rounded-full bg-paper px-4.5 py-1.5">
                Explore the Nhost Ecosystem
              </p>
            </div>

            <SectionHeading 
              title={
                <>
                  Complete your <span className="bg-gradient-to-br from-brand-light via-brand-main to-brand-dark bg-clip-text text-transparent">backend stack</span>
                </>
              } 
            />
          </div>
        }
        disabledLink="run"
      />

      <CTASection />
    </>
  )
}

NhostRunPage.getLayout = function getLayout(page: ReactElement) {
  return <Layout>{page}</Layout>
}
