import { Button } from '@/ui/Button';
import Loading from '@/ui/Loading';
import { Text } from '@/ui/Text';
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
      <Text className="mt-4 font-medium" size="large" color="dark">
        Functions Logs
      </Text>
      <Text size="normal" color="greyscaleDark" className="mt-1 transform">
        Once you deploy a function, you can view the logs here.
      </Text>
      <div className="mt-1.5 flex text-center">
        <Button
          Component="a"
          transparent
          color="blue"
          className="mx-auto cursor-pointer font-medium"
          href="https://docs.nhost.io/platform/serverless-functions"
          target="_blank"
          rel="noreferrer"
        >
          Read more
        </Button>
      </div>
      <div className="mt-24 flex flex-col text-center">
        <Loading />
        <Text size="normal" color="greyscaleDark" className="mt-1 transform">
          Awaiting new requests…
        </Text>
      </div>
    </div>
  );
}

export default FunctionsNotDeployed;
