import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export function WorkspaceInvoices() {
  const { currentWorkspace } = useCurrentWorkspaceAndApplication();
  const [loading, setLoading] = useState(false);

  const handleViewInvoices = async () => {
    setLoading(true);
    const { res, error } = await nhost.functions.call('/stripe-create-portal', {
      workspaceId: currentWorkspace.id,
    });

    if (error) {
      setLoading(false);
      triggerToast(`Unable to get Stripe Customer Portal URL`);
      return;
    }

    const { url } = res.data;

    window.open(url, '_blank');

    setLoading(false);
  };

  return (
    <div className="mt-18">
      <div className="mx-auto grid max-w-3xl grid-flow-row justify-start gap-2 font-display">
        <Text className="text-lg font-medium">Invoices</Text>

        <Button
          variant="outlined"
          color="secondary"
          onClick={handleViewInvoices}
          loading={loading}
        >
          View Invoices in the Stripe Customer Portal
        </Button>
      </div>
    </div>
  );
}

export default WorkspaceInvoices;
