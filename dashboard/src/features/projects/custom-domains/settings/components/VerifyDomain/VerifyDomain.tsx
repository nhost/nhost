import { Box } from '@/components/ui/v2/Box';
import { Button } from '@/components/ui/v2/Button';
import { IconButton } from '@/components/ui/v2/IconButton';
import { CopyIcon } from '@/components/ui/v2/icons/CopyIcon';
import { Text } from '@/components/ui/v2/Text';
import { getToastStyleProps } from '@/utils/constants/settings';
import { copy } from '@/utils/copy';
import { useDnsLookupCnameLazyQuery } from '@/utils/__generated__/graphql';
import { ApolloError } from '@apollo/client';
import { useState } from 'react';
import { toast } from 'react-hot-toast';

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
  const [verificationFailed, setVerificationFailed] = useState(false);
  const [verificationSucceeded, setVerificationSucceeded] = useState(false);

  const [loading, setLoading] = useState(false);
  const [fireLookupCNAME] = useDnsLookupCnameLazyQuery();

  const handleVerifyDomain = async () => {
    setLoading(true);

    try {
      await toast.promise(
        fireLookupCNAME({
          variables: {
            hostname,
          },
        }).then(({ data: { dnsLookupCNAME } }) => {
          if (dnsLookupCNAME !== value) {
            throw new Error(`Could not verify ${hostname}`);
          }
        }),
        {
          loading: `Verifying ${hostname} ...`,
          success: () => {
            setVerificationFailed(false);
            setVerificationSucceeded(true);
            setLoading(false);
            onHostNameVerified?.();
            return `${hostname} has been verified.`;
          },
          error: (arg: Error | ApolloError) => {
            setVerificationFailed(true);
            setVerificationSucceeded(false);
            setLoading(false);

            if (arg instanceof ApolloError) {
              // we need to get the internal error message from the GraphQL error
              const { internal } = arg.graphQLErrors[0]?.extensions || {};
              const { message } =
                (internal as Record<string, any>)?.error || {};

              // we use the default Apollo error message if we can't find the
              // internal error message
              return (
                message ||
                arg.message ||
                `An error occurred while trying to verify ${hostname}. Please try again.`
              );
            }

            return arg.message;
          },
        },
        getToastStyleProps(),
      );
    } catch (error) {
      // Note: The toast will handle the error.
    }
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
      ]}
      className="flex flex-col p-4 space-y-4 rounded-md"
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
          <Text className="font-bold">{value}</Text>
          <IconButton
            aria-label="Copy Personal Access Token"
            variant="borderless"
            color="secondary"
            onClick={() => copy(value, 'CNAME Value')}
          >
            <CopyIcon className="w-4 h-4" />
          </IconButton>
        </div>
        <Button
          disabled={loading || !hostname}
          onClick={handleVerifyDomain}
          className="mt-4 sm:absolute sm:bottom-0 sm:right-0 sm:mt-0"
        >
          Verify
        </Button>
      </div>
    </Box>
  );
}
