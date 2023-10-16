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
  onHostNameVerified: () => void;
}

export default function VerifyDomain({
  recordType,
  hostname,
  value,
  onHostNameVerified,
}: VerifyDomainProps) {
  const [isVerified, setIsVerified] = useState(false);
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
            setIsVerified(true);
            setLoading(false);
            onHostNameVerified();
            return `${hostname} has been verified. Now click on save to apply.`;
          },
          error: (arg: Error | ApolloError) => {
            setIsVerified(false);
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
      sx={{ backgroundColor: 'primary.light' }}
      className="flex flex-col space-y-4 rounded-md p-4"
    >
      <div className="flex flex-row items-center justify-between">
        <p>Add the record below in your DNS provider to verify {hostname}</p>
        <Button disabled={isVerified || loading} onClick={handleVerifyDomain}>
          Verify
        </Button>
      </div>

      <div className="flex flex-col text-slate-500">
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
            <CopyIcon className="h-4 w-4" />
          </IconButton>
        </div>
      </div>
    </Box>
  );
}
