import { Button } from '@/components/common/Button';
import { Link } from '@/components/common/Link';
import { X } from 'lucide-react';

export interface CookieConsentProps {
  /** The saved choice: `true` accepted, `false` rejected, `null` none yet. */
  consent: boolean | null;
  onAccept: () => void;
  onReject: () => void;
  onClose: () => void;
}

export default function CookieConsent({
  consent,
  onAccept,
  onReject,
  onClose,
}: CookieConsentProps) {
  return (
    <div
      role="dialog"
      aria-label="Cookie consent"
      className="fixed inset-x-4 bottom-4 z-50 rounded-lg border border-divider bg-black/95 p-5 shadow-lg backdrop-blur-sm sm:left-auto sm:w-96"
    >
      {consent !== null && (
        <div className="mb-3 flex items-start justify-between gap-4">
          <p className="font-medium text-white">
            {consent
              ? 'You accepted cookies. Rejecting them reloads the page.'
              : 'You rejected cookies.'}
          </p>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close cookie settings"
            className="text-white text-opacity-65 hover:text-opacity-100"
          >
            <X size={16} />
          </button>
        </div>
      )}
      <p className="mb-4 text-white text-opacity-65">
        We use cookies to understand how Nhost is used and to improve it.{' '}
        <Link href="/legal/cookies-policy" className="inline text-opacity-100 underline">
          Learn more
        </Link>
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
