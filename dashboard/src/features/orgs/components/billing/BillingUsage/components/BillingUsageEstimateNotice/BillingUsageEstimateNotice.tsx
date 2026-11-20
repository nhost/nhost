import { Alert, AlertDescription, AlertTitle } from '@/components/ui/v3/alert';
import { TextLink } from '@/components/ui/v3/text-link';

export default function BillingUsageEstimateNotice() {
  return (
    <Alert role="note">
      <AlertTitle>Usage figures are estimates</AlertTitle>
      <AlertDescription>
        Your invoices show what you're billed. See{' '}
        <TextLink href="https://nhost.io/pricing" external>
          pricing
        </TextLink>{' '}
        and{' '}
        <TextLink
          href="https://docs.nhost.io/platform/cloud/billing#usage"
          external
        >
          how usage is billed
        </TextLink>
        .
      </AlertDescription>
    </Alert>
  );
}
