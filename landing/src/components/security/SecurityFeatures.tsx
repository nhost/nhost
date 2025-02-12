import { ActivitySquare, Key, Lock, ShieldCheck } from "lucide-react"
import { Container, ContainerProps } from '@/components/common/Container'
import { ServiceCard } from '@/components/common/ServiceCard'
import Image from 'next/image'
import { ReactNode } from 'react'
import { twMerge } from 'tailwind-merge'
import { LineGrid } from "../common/LineGrid"
import { CreditCard, Database } from "lucide-react"
export function SecurityFeatures() {
  return (
    <Container
        component="section"
        className="relative grid max-w-lg grid-cols-1 gap-6 pb-16 sm:grid-cols-1 lg:max-w-7xl lg:grid-cols-3 lg:pb-28"
    >
        <ServiceCard
          icon={<ShieldCheck size={24} />}
          title="SOC 2 Type II (audit window nearing completion)"
          description="Nhost is working towards SOC2 Type 2 compliance. This is an audit report that evaluates our security controls when handling sensitive customer data. Team and Enterprise customers will be able to access our SOC2 report on the dashboard once the audit is complete."
        />
        <ServiceCard
          icon={<ActivitySquare size={24} />}
          title="HIPAA (coming soon)"
          description="Nhost is working towards HIPAA compliance. You will be able to store Protected Health Information (PHI) on our hosted platform once we complete the audit."
        />
        <ServiceCard
          icon={<Lock size={24} />}
          title="Multi-factor Authentication"
          description="Nhost lets users enable Multi-Factor Authentication (MFA) for their accounts, adding an extra layer of security by requiring a second factor for identity verification."
        />
        <ServiceCard
          icon={<Key size={24} />}
          title="Data Encryption"
          description="Customer data is encrypted at rest with AES-256 and in transit via TLS."
        />
        <ServiceCard
          icon={<CreditCard size={24} />}
          title="Payments Processing"
          description="Nhost uses Stripe to process payments and does not store any payment information from our customers."
        />
        <ServiceCard
          icon={<Database size={24} />}
          title="Backups"
          description="All paid databases are backed up daily and stored in a secure location."
        />
    </Container>
  )
}

