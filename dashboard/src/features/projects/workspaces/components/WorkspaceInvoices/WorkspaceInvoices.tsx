import { Button } from '@/components/ui/v2/Button';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export default function WorkspaceInvoices() {
  const [loading, setLoading] = useState(false);

  const { currentWorkspace } = useCurrentWorkspaceAndProject();

  return (
    <div className="mt-18">
      <div className="mx-auto grid max-w-3xl grid-flow-row justify-start gap-2 font-display">
        <Text className="text-lg font-medium">Invoices</Text>

        <Button
          variant="outlined"
          color="secondary"
          onClick={async () => {
            setLoading(true);
            const { res, error } = await nhost.functions.call(
              '/stripe-create-portal',
              { workspaceId: currentWorkspace.id },
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
