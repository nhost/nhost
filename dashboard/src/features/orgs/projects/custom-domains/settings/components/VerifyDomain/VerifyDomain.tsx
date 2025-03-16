import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { useIsPlatform } from '@/features/orgs/projects/common/hooks/useIsPlatform';
import { execPromiseWithErrorToast } from '@/features/orgs/utils/execPromiseWithErrorToast';
import { useDnsLookupCnameLazyQuery } from '@/utils/__generated__/graphql';
import { copy } from '@/utils/copy';
import { useState } from 'react';

interface VerifyDomainProps {
  recordType: string;
  hostname: string;
  value: string;
  onHostNameVerified?: () => void;
}

export default function VerifyDomain({
  recordType,
  hostname,
  value,
  onHostNameVerified,
}: VerifyDomainProps) {
  const isPlatform = useIsPlatform();
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [verificationSucceeded, setVerificationSucceeded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fireLookupCNAME] = useDnsLookupCnameLazyQuery();

  const handleVerifyDomain = async () => {
    setLoading(true);

    await execPromiseWithErrorToast(
      async () => {
        await fireLookupCNAME({
          variables: {
            hostname,
          },
        }).then(({ data: { dnsLookupCNAME } }) => {
          if (dnsLookupCNAME !== value) {
            throw new Error(`Could not verify ${hostname}`);
          }
        });

        setVerificationFailed(false);
        setVerificationSucceeded(true);
        setLoading(false);
        onHostNameVerified?.();
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
    <Box
      sx={[
        { backgroundColor: 'primary.light' },
        verificationFailed && {
          backgroundColor: 'error.light',
          color: 'error.main',
        },
        verificationSucceeded && {
          backgroundColor: 'success.light',
          color: 'success.dark',
        },
        !isPlatform && {
          backgroundColor: 'grey.300',
        },
      ]}
      className="flex flex-col space-y-4 rounded-md p-4"
    >
      <div className="flex flex-row items-center justify-between">
        {!verificationFailed && !verificationSucceeded && (
          <Text>
            Add the record below in your DNS provider to verify {hostname}
          </Text>
        )}

        {verificationSucceeded && (
          <Text>
            <span className="font-semibold">{hostname}</span> was verified
            successfully. Hit save to apply.
          </Text>
        )}

        {verificationFailed && (
          <Text>
            An error occurred while trying to verify{' '}
            <span className="font-semibold">{hostname}</span>. Make sure you
            correctly added the <span className="font-semibold">CNAME</span> and
            try again.
          </Text>
        )}
      </div>

      <div className="relative flex flex-col text-slate-500">
        <div className="flex space-x-2">
          <Text>Record type: </Text>
          <Text className="font-bold">{recordType}</Text>
        </div>
        <div className="flex space-x-2">
          <Text>Host:</Text>
          <Text className="font-bold">{hostname}</Text>
        </div>
        <div className="flex flex-row space-x-2">
          <Text>Value:</Text>
          {isPlatform ? (
            <>
              <Text className="font-bold">{value}</Text>
              <IconButton
                aria-label="Copy Personal Access Token"
                variant="borderless"
                color="secondary"
                onClick={() => copy(value, 'CNAME Value')}
              >
                <CopyIcon className="h-4 w-4" />
              </IconButton>
            </>
          ) : null}
        </div>
        {isPlatform ? (
          <Button
            disabled={loading || !hostname}
            onClick={handleVerifyDomain}
            className="mt-4 sm:absolute sm:bottom-0 sm:right-0 sm:mt-0"
          >
            Verify
          </Button>
        ) : null}
      </div>
    </Box>
  );
}
