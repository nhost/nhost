import { CopyIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { Button } from '@/components/ui/v3/button';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { isNotEmptyValue } from '@/lib/utils';
import { useDnsLookupCnameLazyQuery } from '@/utils/__generated__/graphql';
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

  return (
    <div
      className={`flex flex-col space-y-4 rounded-md p-4 ${
        verificationFailed
          ? 'bg-destructive/10 text-destructive'
          : verificationSucceeded
            ? 'bg-green-100 text-green-900'
            : !isPlatform
              ? 'bg-muted text-muted-foreground'
              : 'bg-primary/10 text-foreground'
      }`}
    >
      <div className="flex flex-row items-center justify-between">
        {!verificationFailed && !verificationSucceeded && (
          <p>Add the record below in your DNS provider to verify {hostname}</p>
        )}

        {verificationSucceeded && (
          <p>
            <span className="font-semibold">{hostname}</span> was verified
            successfully. {saveEnabled ? 'Hit save to apply.' : ''}
          </p>
        )}

        {verificationFailed && (
          <p>
            An error occurred while trying to verify{' '}
            <span className="font-semibold">{hostname}</span>. Make sure you
            correctly added the <span className="font-semibold">CNAME</span> and
            try again.
          </p>
        )}
      </div>

      <div className="relative flex flex-col text-slate-500">
        <div className="flex space-x-2">
          <p>Record type: </p>
          <p className="font-bold">{recordType}</p>
        </div>
        <div className="flex space-x-2">
          <p>Host:</p>
          <p className="font-bold">{hostname}</p>
        </div>
        <div className="flex flex-row space-x-2">
          <p>Value:</p>
          {isPlatform ? (
            <>
              <p className="font-bold">{value}</p>
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
        </div>
        {isPlatform ? (
          <Button
            disabled={loading || !hostname}
            onClick={handleVerifyDomain}
            className="mt-4 sm:absolute sm:right-0 sm:bottom-0 sm:mt-0"
          >
            Verify
          </Button>
        ) : null}
      </div>
    </div>
  );
}
