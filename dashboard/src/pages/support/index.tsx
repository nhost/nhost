import { getSupportHubLayout } from '@/features/support/components/SupportArea';
import SupportHub from '@/features/support/components/SupportHub';

export default function SupportPage() {
  return <SupportHub />;
}

SupportPage.getLayout = getSupportHubLayout;
