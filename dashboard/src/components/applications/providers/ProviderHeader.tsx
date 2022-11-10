import Help from '@/components/icons/Help';
import type { Provider } from '@/types/providers';
import { Text } from '@/ui/Text';
import { resolveProvider } from '@/utils/resolveProvider';
import Image from 'next/image';
import { useRouter } from 'next/router';

type ProviderHeaderProps = {
  provider: Provider;
};

export function ProviderHeader({ provider }: ProviderHeaderProps) {
  const router = useRouter();
  const providerId = router.query.providerId as string;

  return (
    <div className="flex flex-row items-center space-x-2">
      <div className="w-14">
        <Image
          src={`/assets/${resolveProvider(providerId)}.svg`}
          alt={`Logo of ${provider.name}`}
          width={56}
          height={56}
          layout="responsive"
        />
      </div>
      <div className="flex w-full flex-row place-content-between">
        <Text color="dark" className="font-medium capitalize" size="big">
          {provider.name}
        </Text>
        {provider.docsLink && (
          <div className="flex flex-col">
            <a href={provider.docsLink} target="_blank" rel="noreferrer">
              <Help className="h-10 w-10" />
            </a>
          </div>
        )}
      </div>
    </div>
  );
}

export default ProviderHeader;
