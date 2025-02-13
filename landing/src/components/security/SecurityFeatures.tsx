import { ActivitySquare, Key, Lock, ShieldCheck } from "lucide-react"
import { Container } from '@/components/common/Container'
import { ServiceCard } from '@/components/common/ServiceCard'
import { CreditCard, Database, Cloud } from "lucide-react"
export function SecurityFeatures() {
  return (
    <>
    <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-2 lg:pb-28"
    >
        <ServiceCard
          icon={<ShieldCheck size={24} />}
          title="SOC 2 Type II (coming soon)"
          description="Nhost is working towards SOC2 Type 2 compliance. This is an audit report that evaluates our security controls when handling sensitive customer data. Team & Enterprise customers will be able to access our SOC2 report on the dashboard once the audit is complete."
        />
        <ServiceCard
          icon={<ActivitySquare size={24} />}
          title="HIPAA (coming soon)"
          description="Nhost is working towards HIPAA compliance. Team & Enterprise customers will be able to store Protected Health Information (PHI) on our hosted platform once we complete the audit."
        />
    </Container>
    <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-3 lg:pb-28"
    >
        <ServiceCard
          icon={<Cloud size={24} />}
          title="AWS Cloud Infrastructure"
          description="Nhost is hosted on AWS, a leading cloud provider with a strong track record of security and reliability."
        />
        <ServiceCard
          icon={<Lock size={24} />}
          title="Multi-factor Authentication"
          description="Nhost lets users enable Multi-Factor Authentication (MFA) for their accounts, adding an extra layer of security by requiring a second factor for identity verification."
        />
        <ServiceCard
          icon={<Key size={24} />}
          title="Encryption at Rest"
          description="All data is encrypted at rest with AES-256. This includes databases, storage files, and run services volumes."
        />
        <ServiceCard
          icon={<Key size={24} />}
          title="Encryption in Transit"
          description="All data is encrypted in transit with TLS."
        />
        <ServiceCard
          icon={<CreditCard size={24} />}
          title="Payments Processing"
          description="Nhost uses Stripe to process payments and does not store any billing information from our customers."
        />
        <ServiceCard
          icon={<Database size={24} />}
          title="Backups"
          description="All paid databases are backed up daily and stored in a secure location."
        />
        <ServiceCard
          icon={<Database size={24} />}
          title="Vulnerability Scanning"
          description="We perform regular vulnerability scans to ensure our platform is secure."
        />
        <ServiceCard
          icon={<Database size={24} />}
          title="Logging and Monitoring"
          description="We actively monitor and log all activity on the platform to ensure security and detect anomalies."
        />
        <ServiceCard
          icon={<Database size={24} />}
          title="Incident Response"
          description="We have a documented incident response plan in place to ensure we can respond to security incidents quickly and effectively."
        />
    </Container>
    </>
  )
}

