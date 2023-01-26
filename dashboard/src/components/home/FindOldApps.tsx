import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';

export function FindOldApps() {
  return (
    <div className="mt-4">
      <Text className="font-medium" color="secondary">
        Looking for your old apps? They&apos;re still on{' '}
        <span className="pb-0.25">
          <Link
            href="https://console.nhost.io"
            target="_blank"
            rel="noreferrer"
            underline="hover"
          >
            console.nhost.io
          </Link>
        </span>{' '}
        during this beta.
      </Text>
    </div>
  );
}

export default FindOldApps;
