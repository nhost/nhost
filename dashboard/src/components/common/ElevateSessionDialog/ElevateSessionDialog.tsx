import type { ElevationMethod } from '@nhost/nhost-js/auth';
import { useEffect, useState } from 'react';
import { elevationMethodDetails } from '@/components/common/ElevateSessionDialog/elevationMethods';
import OtpElevation from '@/components/common/ElevateSessionDialog/OtpElevation';
import WebauthnElevation from '@/components/common/ElevateSessionDialog/WebauthnElevation';
import { Button } from '@/components/ui/v3/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/v3/dialog';

interface Props {
  open: boolean;
  methods: ElevationMethod[];
  onCancel: () => void;
  onElevated: () => void;
}

const descriptions: Record<ElevationMethod, string> = {
  webauthn: 'Confirm your identity with your security key to continue.',
  totp: 'Enter the code from your authenticator app to continue.',
  'otp-email': 'Enter the code we sent to your email address to continue.',
  'otp-sms': 'Enter the code we sent to your phone number to continue.',
};

function ElevateSessionDialog({ open, methods, onCancel, onElevated }: Props) {
  const [method, setMethod] = useState<ElevationMethod | null>(null);

  useEffect(() => {
    setMethod(methods.length === 1 ? methods[0] : null);
  }, [methods]);

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onCancel();
        }
      }}
    >
      <DialogContent className="z-[9999] max-w-[28rem] text-foreground">
        <DialogHeader>
          <DialogTitle>Verify it&apos;s you</DialogTitle>
          <DialogDescription>
            {method
              ? descriptions[method]
              : 'Choose how you want to verify your identity to continue.'}
          </DialogDescription>
        </DialogHeader>

        {!method && (
          <div className="grid grid-flow-row gap-2">
            {methods.map((availableMethod) => {
              const {
                label,
                description,
                icon: Icon,
              } = elevationMethodDetails[availableMethod];

              return (
                <Button
                  key={availableMethod}
                  variant="outline"
                  className="h-auto justify-start gap-3 py-3"
                  onClick={() => setMethod(availableMethod)}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  <span className="grid grid-flow-row justify-items-start">
                    <span className="font-medium">{label}</span>
                    <span className="text-muted-foreground text-xs">
                      {description}
                    </span>
                  </span>
                </Button>
              );
            })}
          </div>
        )}

        {method === 'webauthn' && <WebauthnElevation onElevated={onElevated} />}

        {method && method !== 'webauthn' && (
          <OtpElevation key={method} method={method} onElevated={onElevated} />
        )}

        {method && methods.length > 1 && (
          <Button variant="ghost" onClick={() => setMethod(null)}>
            Use another method
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default ElevateSessionDialog;
