import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { Text } from '@/ui/Text';
import Button from '@/ui/v2/Button';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export function WorkspaceInvoices() {
  const [loading, setLoading] = useState(false);

  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="mt-18">
      <div className="mx-auto max-w-3xl font-display">
        <div className="flex flex-row place-content-between">
          <Text
            variant="body"
            size="large"
            color="greyscaleDark"
            className="font-medium"
          >
            Invoices
          </Text>
        </div>
        <div>
          <Button
            variant="outlined"
            color="secondary"
            onClick={async () => {
              setLoading(true);
              const { res, error } = await nhost.functions.call(
                '/stripe-create-portal',
                {
                  workspaceId: currentWorkspace.id,
                },
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
    </div>
  );
}

export default WorkspaceInvoices;
