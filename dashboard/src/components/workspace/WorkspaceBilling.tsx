import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export function WorkspaceBilling() {
  const [loading, setLoading] = useState(false);

  const { currentWorkspace } = useCurrentWorkspaceAndApplication();

  return (
    <div className="mt-18">
      <div className="mx-auto grid max-w-3xl grid-flow-row justify-start gap-2 font-display">
        <Text className="text-lg font-medium">Billing</Text>

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
          Manage Payment Methods and Billing
        </Button>
      </div>
    </div>
  );
}

export default WorkspaceBilling;
