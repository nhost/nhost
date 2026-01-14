import { Button } from '@/components/ui/v3/button';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useNhostClient } from '@/providers/nhost';
import { Organization_Status_Enum } from '@/utils/__generated__/graphql';
import { Download } from 'lucide-react';
import { useState } from 'react';

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
    <div className="flex w-full flex-col rounded-md border bg-background">
      <div className="w-full border-b p-4 font-medium">
        SOC2 Compliance Report
      </div>

      <div className="flex w-full flex-col gap-4 p-4">
        <div className="flex flex-col gap-2">
          <p className="text-muted-foreground text-sm">
            Download Nhost&apos;s SOC2 Type II compliance report. This report
            demonstrates our commitment to security controls.
          </p>
        </div>

        <div className="flex justify-start">
          <Button
            onClick={handleDownload}
            disabled={downloading}
            variant="outline"
            className="flex items-center gap-2"
          >
            <Download className="h-4 w-4" />
            {downloading ? 'Downloading...' : 'Download SOC2 Report'}
          </Button>
        </div>
      </div>
    </div>
  );
}
