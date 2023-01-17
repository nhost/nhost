import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export function WorkspaceInvoices() {
  const [loading, setLoading] = useState(false);

  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="mt-18">
      <div className="mx-auto max-w-3xl font-display grid grid-flow-row gap-2 justify-start">
        <Text className="font-medium text-lg">Invoices</Text>

        <Button
          variant="outlined"
          color="secondary"
          onClick={async () => {
            setLoading(true);
            const { res, error } = await nhost.functions.call(
              '/stripe-create-portal',
              { workspaceId: currentWorkspace.id },
              { useAxios: false },
            );

            if (error) {
              setLoading(false);
              triggerToast(`Unable to get Stripe Customer Portal URL`);
              return;
            }

            const url = (res.data as any).url as string;

            window.open(url, '_blank');
            setLoading(false);
          }}
          loading={loading}
        >
          View Invoices in the Stripe Customer Portal
        </Button>
      </div>
    </div>
  );
}

export default WorkspaceInvoices;
