import { Button } from '@/components/ui/v3/button';
import { useSSRLocalStorage } from '@/hooks/useSSRLocalStorage';
import { X } from 'lucide-react';
import NextLink from 'next/link';
import { useEffect, useState } from 'react';

interface CookieConsentProps {
  onAccept: () => void;
}

export default function CookieConsent({ onAccept }: CookieConsentProps) {
  const [consentGiven, setConsentGiven] = useSSRLocalStorage<boolean | null>(
    'cookie-consent',
    null,
  );
  const [showBanner, setShowBanner] = useState(false);

  useEffect(() => {
    if (consentGiven === null) {
      setShowBanner(true);
    } else if (consentGiven === true) {
      onAccept();
    }
  }, [consentGiven, onAccept]);

  const handleAccept = () => {
    setConsentGiven(true);
    setShowBanner(false);
    onAccept();
  };

  const handleDecline = () => {
    setConsentGiven(false);
    setShowBanner(false);
  };

  const handleClose = () => {
    handleDecline();
  };

  if (!showBanner) {
    return null;
  }

  return (
    <div className="fixed right-4 bottom-4 z-50 w-96">
      <div className="rounded-lg border bg-black/95 p-6 shadow-lg backdrop-blur-sm">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <h3 className="mb-3 font-semibold text-sm text-white">
              We use cookies for payments and analytics to improve our services.
            </h3>
            <p className="mb-4 text-[#A2B3BE] text-xs">
              <NextLink
                href="https://nhost.io/legal/privacy-policy"
                target="_blank"
                rel="noopener noreferrer"
                className="text-white underline hover:no-underline"
              >
                Learn more
              </NextLink>
            </p>
            <div className="flex gap-2">
              <Button
                onClick={handleAccept}
                size="sm"
                className="bg-blue-600 px-3 py-1 text-white text-xs hover:bg-blue-700"
              >
                Accept all
              </Button>
              <Button
                onClick={handleDecline}
                variant="outline"
                size="sm"
                className="border-gray-600 px-3 py-1 text-white text-xs hover:bg-gray-800"
              >
                Essential only
              </Button>
            </div>
          </div>
          <button
            onClick={handleClose}
            type="button"
            className="text-[#A2B3BE] hover:text-white"
            aria-label="Close cookie banner"
          >
            <X size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
