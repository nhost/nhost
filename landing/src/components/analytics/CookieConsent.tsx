import { Button } from '@/components/common/Button';
import { Link } from '@/components/common/Link';

export interface CookieConsentProps {
  onAccept: () => void;
  onReject: () => void;
}

export default function CookieConsent({ onAccept, onReject }: CookieConsentProps) {
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-divider bg-black/95 p-5 shadow-lg backdrop-blur-sm sm:left-auto sm:w-96"
    >
      <p className="mb-4 text-white text-opacity-65">
        We use cookies on nhost.io and the Nhost dashboard for analytics and to
        measure our advertising. See our{' '}
        <Link href="/legal/cookies-policy" className="inline text-opacity-100 underline">
          cookies policy
        </Link>
        .
      </p>
      <div className="grid grid-flow-col justify-start gap-2">
        <Button size="sm" onClick={onAccept}>
          Accept
        </Button>
        <Button size="sm" variant="outlined" onClick={onReject}>
          Reject
        </Button>
      </div>
    </div>
  );
}
