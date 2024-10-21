import type { IntegrationType } from '@/features/orgs/projects/metrics/settings/components/ContactPointForm/ContactPointFormTypes';
import { EmailsFormSection } from '../EmailsFormSection';

interface ContactPointFormSectionProps {
  integrationType: IntegrationType;
}

export default function ContactPointFormSection({
  integrationType,
}: ContactPointFormSectionProps) {
  if (integrationType === 'email') {
    return <EmailsFormSection />;
  }

  return null;
}
