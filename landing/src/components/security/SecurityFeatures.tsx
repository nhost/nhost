import { ActivitySquare, Key, Lock, ShieldCheck } from "lucide-react"
import { Container } from '@/components/common/Container'
import { ServiceCard } from '@/components/common/ServiceCard'
import { CreditCard, Database, Cloud } from "lucide-react"
import { Button } from "@/components/common/Button"
import { Mail } from "lucide-react"
import Image from "next/image"
import { SecurityCard } from "@/components/common/SecurityCard"

export function SecurityFeatures() {
  return (
    <>
      <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-14 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-2 lg:pb-24"
      >
        <SecurityCard
          icon={<ShieldCheck size={24} />}
          title="SOC 2 Type II Compliant"
          content={
            <div className="space-y-4">
              <p>
                Nhost is SOC 2 Type II compliant. This comprehensive audit
                verifies our security controls and data handling practices meet
                industry standards. Team & Enterprise customers have access to
                our SOC 2 report directly through the{' '}
                <a
                  href="https://app.nhost.io/orgs/_/settings"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-white underline"
                >
                  Nhost Dashboard
                </a>
                .
              </p>
              <Image
                src="/images/soc2-logo.jpg"
                alt="SOC 2 Type II"
                width={32}
                height={32}
                className="rounded"
              />
            </div>
          }
        />
        <SecurityCard
          icon={<ActivitySquare size={24} />}
          title="HIPAA (coming soon)"
          content={
            <div className="space-y-4">
              <p>
                Nhost is working towards HIPAA compliance. Team & Enterprise
                customers will be able to store Protected Health Information
                (PHI) on our hosted platform once we complete the audit.
              </p>
            </div>
          }
        />
      </Container>
      <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-6 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-3"
      >
        <SecurityCard
          icon={<Cloud size={24} />}
          title="AWS Cloud Infrastructure"
          content={
            <div className="space-y-4">
              <p>
                Nhost is hosted on AWS, a leading cloud provider with a strong
                track record of security and reliability.
              </p>
            </div>
          }
        />
        <SecurityCard
          icon={<Key size={24} />}
          title="Encryption at Rest"
          content={
            <div className="space-y-4">
              <p>
                All data is encrypted at rest with AES-256. This includes
                databases, storage files, and run services volumes.
              </p>
            </div>
          }
        />
        <SecurityCard
          icon={<Key size={24} />}
          title="Encryption in Transit"
          content={
            <div className="space-y-4">
              <p>All data is encrypted in transit with TLS.</p>
            </div>
          }
        />
        <SecurityCard
          icon={<CreditCard size={24} />}
          title="Payments Processing"
          content={
            <div className="space-y-4">
              <p>
                Nhost uses Stripe to process payments and does not store any
                billing information from our customers.
              </p>
            </div>
          }
        />
        <SecurityCard
          icon={<Database size={24} />}
          title="Backups"
          content={
            <div className="space-y-4">
              <p>
                All paid databases are backed up daily and stored in a secure
                location.
              </p>
            </div>
          }
        />
        <SecurityCard
          icon={<Database size={24} />}
          title="Dependency Scanning"
          content={
            <div className="space-y-4">
              <p>
                We perform regular dependency scans to ensure our platform is
                secure.
              </p>
            </div>
          }
        />
      </Container>
      <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-2 lg:pb-28"
      >
        <SecurityCard
          icon={<Database size={24} />}
          title="Logging and Monitoring"
          content={
            <div className="space-y-4">
              <p>
                We actively monitor and log all activity on the platform to
                ensure security and detect anomalies.
              </p>
            </div>
          }
        />
        <SecurityCard
          icon={<Database size={24} />}
          title="Incident Response"
          content={
            <div className="space-y-4">
              <p>
                We have a documented incident response plan in place to ensure
                we can respond to security incidents quickly and effectively.
              </p>
            </div>
          }
        />
      </Container>
      <Container
        component="section"
        className="relative flex flex-col items-center justify-center gap-4 py-16 text-center"
      >
        <h2 className="text-2xl font-bold">Found a Security Vulnerability?</h2>
        <p className="text-muted-foreground max-w-2xl">
          We take security seriously. If you have discovered a security
          vulnerability, please report it to our security team.
        </p>
        <Button
          href="mailto:security@nhost.io"
          className="mt-4"
          variant="outlined"
        >
          <Mail size={16} className="mr-2" />
          Report Vulnerability
        </Button>
      </Container>
    </>
  )
}

