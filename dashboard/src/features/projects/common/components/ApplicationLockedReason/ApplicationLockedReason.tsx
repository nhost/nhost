import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import Link from 'next/link';

interface ApplicationLockedReasonProps {
  reason?: string;
}

export default function ApplicationLockedReason({
  reason,
}: ApplicationLockedReasonProps) {
  return (
    <Alert severity="warning" className="mx-auto max-w-xs gap-2 p-6 ">
      <Text className="pb-4 text-left">
        Your project has been temporarily locked due to the following reasons.
      </Text>
      <Box
        className="rounded-md p-2"
        sx={{
          backgroundColor: (theme) =>
            theme.palette.mode === 'dark' ? '#E5D1BF' : '#E5D1BF',
        }}
      >
        <Text className="font-semibold">{reason}</Text>
      </Box>
      <Text className="pt-4 text-left">
        Please{' '}
        <Link
          className="font-semibold underline underline-offset-2"
          href="mailto:support@nhost.io"
          target="_blank"
          rel="noopener noreferrer"
        >
          contact our support
        </Link>{' '}
        team for assistance.
      </Text>
    </Alert>
  );
}
