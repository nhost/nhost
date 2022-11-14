import { Text } from '@/ui/Text';

export function FindOldApps() {
  return (
    <div className="mt-4">
      <Text color="greyscaleGrey" size="normal" className="font-medium">
        Looking for your old apps? They’re still on{' '}
        <span className="pb-0.25 border-b">
          <a href="https://console.nhost.io" target="_blank" rel="noreferrer">
            console.nhost.io
          </a>
        </span>{' '}
        during this beta.
      </Text>
    </div>
  );
}

export default FindOldApps;
