import { CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Alert } from '@/components/ui/v3/alert';
import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDnsLookupCnameLazyQuery } from '@/generated/graphql';
import { isNotEmptyValue } from '@/lib/utils';
import { copy } from '@/utils/copy';

interface VerifyDomainProps {
  recordType: string;
  hostname?: string;
  value: string;
  onHostNameVerified?: () => void;
  saveEnabled?: boolean;
}

export default function VerifyDomain({
  recordType,
  hostname,
  value,
  onHostNameVerified,
  saveEnabled = true,
}: VerifyDomainProps) {
  const isPlatform = useIsPlatform();
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [verificationSucceeded, setVerificationSucceeded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fireLookupCNAME] = useDnsLookupCnameLazyQuery();

  // biome-ignore lint/correctness/useExhaustiveDependencies: state needs to be reset when hostname or value changes
  useEffect(() => {
    setVerificationFailed(false);
    setVerificationSucceeded(false);
    setLoading(false);
  }, [hostname, value]);

  const handleVerifyDomain = async () => {
    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        if (isNotEmptyValue(hostname)) {
          await fireLookupCNAME({
            variables: {
              hostname,
            },
          }).then(({ data }) => {
            if (data?.dnsLookupCNAME !== value) {
              throw new Error(`Could not verify ${hostname}`);
            }
          });

          setVerificationFailed(false);
          setVerificationSucceeded(true);
          setLoading(false);
          onHostNameVerified?.();
        }
      },
      {
        loadingMessage: `Verifying ${hostname} ...`,
        successMessage: `${hostname} has been verified.`,
        errorMessage: `An error occurred while trying to verify ${hostname}. Please try again.`,
        onError: () => {
          setVerificationFailed(true);
          setVerificationSucceeded(false);
          setLoading(false);
        },
      },
    );
  };

  const variant = verificationFailed
    ? 'destructive'
    : verificationSucceeded
      ? 'success'
      : 'default';

  return (
    <Alert variant={variant} iconPosition="top">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex min-w-0 flex-1 flex-col gap-3">
          {!verificationFailed && !verificationSucceeded && (
            <p className="font-medium">
              Add the record below in your DNS provider to verify {hostname}
            </p>
          )}

          {verificationSucceeded && (
            <p className="font-medium">
              <span className="font-semibold">{hostname}</span> was verified
              successfully. {saveEnabled ? 'Hit save to apply.' : ''}
            </p>
          )}

          {verificationFailed && (
            <p className="font-medium">
              An error occurred while trying to verify{' '}
              <span className="font-semibold">{hostname}</span>. Make sure you
              correctly added the <span className="font-semibold">CNAME</span>{' '}
              and try again.
            </p>
          )}

          <dl className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-1.5 text-sm">
            <dt className="text-muted-foreground">Record type</dt>
            <dd className="font-mono">{recordType}</dd>

            <dt className="text-muted-foreground">Host</dt>
            <dd className="min-w-0 break-all font-mono">
              {hostname || (
                <span className="font-sans text-muted-foreground text-sm">
                  Enter a domain above
                </span>
              )}
            </dd>

            <dt className="text-muted-foreground">Value</dt>
            <dd className="flex min-w-0 items-center gap-1">
              {isPlatform ? (
                <>
                  <span className="break-all font-mono">{value}</span>
                  <Button
                    aria-label="Copy CNAME value"
                    variant="ghost"
                    size="icon"
                    onClick={() => copy(value, 'CNAME Value')}
                  >
                    <CopyIcon className="h-4 w-4" />
                  </Button>
                </>
              ) : null}
            </dd>
          </dl>
        </div>

        {isPlatform ? (
          <Button
            variant="outline"
            disabled={loading || !hostname}
            onClick={handleVerifyDomain}
          >
            Verify
          </Button>
        ) : null}
      </div>
    </Alert>
  );
}
