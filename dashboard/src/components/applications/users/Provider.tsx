import type { Provider as ProviderType } from '@/types/providers';
import Status, { StatusEnum } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { ChevronRightIcon } from '@heroicons/react/solid';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/router';

interface ProviderProps {
  provider: ProviderType;
  enabled: boolean;
}

export function Provider({ provider, enabled }: ProviderProps) {
  const { name, logo } = provider;

  const {
    query: { workspaceSlug, appSlug },
  } = useRouter();

  const nameLowerCase = name.toLowerCase();
  return (
    <Link
      href={`/${workspaceSlug}/${appSlug}/settings/sign-in-methods/${nameLowerCase}`}
      passHref
    >
      <a
        href={`${workspaceSlug}/${appSlug}/settings/sign-in-methods/${nameLowerCase}`}
        className="flex cursor-pointer flex-row place-content-between border-t py-2.5"
      >
        <div className="grid grid-flow-col items-center gap-2">
          <div className="h-6 w-6">
            <Image
              src={logo}
              alt={`Logo of ${name}`}
              width={24}
              height={24}
              layout="responsive"
            />
          </div>
          <Text className="font-medium" color="greyscaleDark" size="normal">
            {name}
          </Text>
        </div>
        <div className="flex flex-row">
          {enabled ? (
            <Status status={StatusEnum.Live}>Enabled</Status>
          ) : (
            <Status status={StatusEnum.Closed}>Disabled</Status>
          )}
          <ChevronRightIcon className="ml-2 h-4 w-4 cursor-pointer self-center" />
        </div>
      </a>
    </Link>
  );
}

export default Provider;
