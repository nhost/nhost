import Button from '@/ui/v2/Button';
import type {
  ButtonProps as MaterialButtonProps,
  ButtonTypeMap,
} from '@mui/material/Button';

import { nhost } from '@/utils/nhost';
import { triggerToast } from '@/utils/toast';
import { useState } from 'react';

export type StripeCustomerPortalButtonProps<
  D extends React.ElementType = ButtonTypeMap['defaultComponent'],
  P = {},
> = Omit<MaterialButtonProps<D, P>, 'variant'> & {
  /**
   * Workspace id to get the Stripe Customer Portal URL for.
   */
  workspaceId: string;
};

function StripeCustomerPortalButton({
  workspaceId,
  ...props
}: StripeCustomerPortalButtonProps) {
  const [loading, setLoading] = useState(false);

  return (
    <Button
      variant="outlined"
      color="secondary"
      onClick={async () => {
        setLoading(true);
        const { res, error } = await nhost.functions.call(
          '/stripe-create-portal',
          { workspaceId },
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
      {...props}
    >
      Manage Payment Methods and Billing
    </Button>
  );
}

export default StripeCustomerPortalButton;
