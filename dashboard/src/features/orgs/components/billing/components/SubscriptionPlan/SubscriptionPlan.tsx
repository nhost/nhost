import { ArrowSquareOutIcon } from '@/components/ui/v2/icons/ArrowSquareOutIcon';
import { Link } from '@/components/ui/v2/Link';
import { Button } from '@/components/ui/v3/button';
import { useCurrentOrg } from '@/features/orgs/projects/hooks/useCurrentOrg';
import { Slash } from 'lucide-react';

export default function SubscriptionPlan() {
  const { org } = useCurrentOrg();

  return (
    <div>
      <div className="flex flex-col w-full border rounded-md bg-background">
        <div className="flex flex-col w-full gap-1 p-4 border-b">
          <h4 className="font-medium">Subscription plan</h4>
        </div>
        <div className="flex flex-col border-b md:flex-row">
          <div className="flex flex-col w-full gap-4 p-4">
            <span className="font-medium">Organization name</span>
            <span className="font-medium">{org?.name}</span>
          </div>
          <div className="flex flex-col w-full gap-2 p-4">
            <span className="font-medium">Current plan</span>
            <span className="text-xl font-bold text-primary-main">
              {org?.plan?.name}
            </span>
          </div>
          <div className="flex flex-col items-start justify-start w-full gap-4 p-4 md:items-end md:justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xl font-semibold">${org?.plan?.price}</span>
              <Slash
                className="w-5 h-5 text-muted-foreground/40"
                strokeWidth={2.5}
              />
              <span className="text-xl font-semibold">month</span>
            </div>
          </div>
        </div>
        <div className="flex flex-col-reverse items-end justify-between w-full gap-2 p-4 md:flex-row md:items-center md:gap-0">
          <div>
            <span>For a complete list of features, visit our </span>
            <Link
              href="https://nhost.io/pricing"
              target="_blank"
              rel="noopener noreferrer"
              underline="hover"
              className="font-medium"
            >
              pricing
              <ArrowSquareOutIcon className="w-4 h-4 ml-1" />
            </Link>
          </div>
          <div className="flex flex-row items-center justify-end gap-2">
            <Button
              className="h-fit"
              variant="secondary"
              disabled={org?.plan?.isFree}
            >
              Update payment details
            </Button>
            <Button disabled={org?.plan?.isFree} className="h-fit">
              Upgrade
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
