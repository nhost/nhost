import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Button from '@/ui/v2/Button';
import Text from '@/ui/v2/Text';
import Image from 'next/image';

export function FunctionsNotDeployed() {
  return (
    <div className="mx-auto mt-12 max-w-2xl text-center">
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/terminal-text.svg"
          alt="Terminal with a green dot"
          width={72}
          height={72}
        />
      </div>
      <Text className="mt-4 font-medium text-lg">Functions Logs</Text>
      <Text className="mt-1 transform">
        Once you deploy a function, you can view the logs here.
      </Text>
      <div className="mt-1.5 flex text-center">
        <Button
          variant="borderless"
          className="mx-auto cursor-pointer font-medium"
          href="https://docs.nhost.io/platform/serverless-functions"
          // Both `target` and `rel` are available when `href` is set. This is
          // a limitation of MUI.
          // @ts-ignore
          target="_blank"
          rel="noreferrer"
        >
          Read more
        </Button>
      </div>
      <div className="mt-12 flex flex-col text-center">
        <ActivityIndicator
          label="Awaiting new requests..."
          className="mx-auto"
        />
      </div>
    </div>
  );
}

export default FunctionsNotDeployed;
