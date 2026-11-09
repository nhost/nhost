import { Download } from 'lucide-react';
import { useState } from 'react';
import {
  SettingsCard,
  SettingsCardHeader,
} from '@/components/layout/SettingsCard';
import { Button } from '@/components/ui/v3/button';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { Organization_Status_Enum } from '@/generated/graphql';
import { useNhostClient } from '@/providers/nhost';

export default function Soc2Download() {
  const { org } = useCurrentOrg();
  const nhost = useNhostClient();
  const [downloading, setDownloading] = useState(false);

  const showSoc2Download =
    (org?.plan?.name === 'Team' || org?.plan?.name?.startsWith('Enterprise')) &&
    org?.status === Organization_Status_Enum.Ok;

  const handleDownload = async () => {
    if (!org || !showSoc2Download) {
      return;
    }

    setDownloading(true);

    await execPromiseWithErrorToast(
      async () => {
        const fileId = process.env.NEXT_PUBLIC_SOC2_REPORT_FILE_ID;

        if (!fileId) {
          throw new Error('SOC2 report file ID not configured');
        }
        try {
          const response = await nhost.storage.getFile(fileId);
          const url = URL.createObjectURL(response.body);
          const link = document.createElement('a');
          link.href = url;
          link.download = 'Nhost-SOC2-Report.pdf';
          link.click();

          URL.revokeObjectURL(url);
        } catch (error) {
          throw new Error(error.message || 'Failed to download SOC2 report');
        }
      },
      {
        loadingMessage: 'Downloading SOC2 report...',
        successMessage: 'SOC2 report downloaded successfully',
        errorMessage:
          'Failed to download SOC2 report. Please try again or contact support.',
      },
    );

    setDownloading(false);
  };

  if (!showSoc2Download) {
    return null;
  }

  return (
    <SettingsCard>
      <SettingsCardHeader
        size="lg"
        title="SOC2 compliance report"
        description="Download Nhost's SOC2 Type II compliance report. This report demonstrates our commitment to security controls."
        control={
          <Button
            onClick={handleDownload}
            disabled={downloading}
            variant="outline"
            className="w-full gap-2 sm:w-auto"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download report'}
          </Button>
        }
      />
    </SettingsCard>
  );
}
