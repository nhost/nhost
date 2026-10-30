import { RouteTabLink, RouteTabs } from '@/components/ui/v3/route-tabs';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';

/**
 * Usage is only reported for paid plans, so on a free plan its tab is
 * hidden.
 */
export default function BillingRouteTabs() {
  const { org } = useCurrentOrg();
  const billingPath = `/orgs/${org.slug}/billing`;

  return (
    <RouteTabs aria-label="Billing section navigation">
      <RouteTabLink href={billingPath} exact>
        Plan
      </RouteTabLink>
      {!org.plan.isFree && (
        <RouteTabLink href={`${billingPath}/usage`} exact>
          Usage
        </RouteTabLink>
      )}
    </RouteTabs>
  );
}
