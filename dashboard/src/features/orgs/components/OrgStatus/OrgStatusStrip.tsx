import { OctagonAlert } from 'lucide-react';
import { useRouter } from 'next/router';
import type { ReactNode } from 'react';
import { TextLink } from '@/components/ui/v3/text-link';
import { useIsOrgAdmin } from '@/features/orgs/hooks/useIsOrgAdmin';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Organization_Status_Enum } from '@/generated/graphql';
import { SUPPORT_TICKET_URL } from '@/utils/constants/common';

const BILLING_ROUTE = '/orgs/[orgSlug]/billing';

interface StripAction {
  label: string;
  href: string;
  external?: boolean;
}

function Strip({
  children,
  action,
}: {
  children: ReactNode;
  action?: StripAction;
}) {
  return (
    <section
      aria-label="Organization status"
      className="shrink-0 bg-[hsl(var(--destructive-gradient-active-from))] text-destructive-foreground"
    >
      <div
        role="status"
        className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 px-4 py-1.5 text-center font-medium text-sm"
      >
        <span className="inline-flex items-center gap-2">
          <OctagonAlert className="h-4 w-4 shrink-0" aria-hidden />
          {children}
        </span>
        {action && (
          <TextLink
            href={action.href}
            external={action.external}
            className="rounded-sm font-semibold text-inherit underline underline-offset-4 focus-visible:outline focus-visible:outline-2 focus-visible:outline-current focus-visible:outline-offset-2"
          >
            {action.label}
            {action.external && (
              <span className="sr-only">(opens in a new tab)</span>
            )}
          </TextLink>
        )}
      </div>
    </section>
  );
}

/**
 * A thin, full width strip across the top of the dashboard while the
 * organization needs attention.
 */
export default function OrgStatusStrip() {
  const { org } = useCurrentOrg();
  const isAdmin = useIsOrgAdmin();
  const { pathname } = useRouter();

  if (!org) {
    return null;
  }

  const billingHref = `/orgs/${org.slug}/billing`;
  const billingAction =
    pathname === BILLING_ROUTE
      ? undefined
      : { label: 'Go to billing', href: billingHref };

  switch (org.status) {
    case Organization_Status_Enum.AllowanceExceeded:
      return (
        <Strip
          action={
            isAdmin
              ? {
                  label: 'View upgrade options',
                  href: `${billingHref}?openUpgradeModal=true`,
                }
              : undefined
          }
        >
          Usage limit exceeded. Projects are paused until the billing cycle
          resets or you move them to a paid organization.
        </Strip>
      );
    case Organization_Status_Enum.Cancelled:
      return (
        <Strip
          action={{
            label: 'Open a support ticket',
            href: SUPPORT_TICKET_URL,
            external: true,
          }}
        >
          Subscription cancelled after multiple failed payments. Contact support
          to restore access.
        </Strip>
      );
    case Organization_Status_Enum.Disabled:
      return (
        <Strip action={billingAction}>
          Organization disabled after failed payments. Projects are paused until
          you add a valid payment method and pay the outstanding invoice.
        </Strip>
      );
    case Organization_Status_Enum.Locked:
      return (
        <Strip action={billingAction}>
          Outstanding invoice. New projects are blocked until you add a valid
          payment method and pay it. Existing projects aren't affected.
        </Strip>
      );
    default:
      return null;
  }
}
