import { capitalize } from '@/utils/helpers';
import Image from 'next/image';

export interface PreviewProps {
  provider: string;
}

export function Preview({ provider }: PreviewProps) {
  return (
    <div className="flex items-center justify-center p-10">
      <Image
        src={`/assets/social-providers/${provider.toLowerCase()}-preview.svg`}
        alt={`${capitalize(provider)} sign in preview`}
        className="mx-auto w-full max-w-md"
        width={480}
        height={267}
      />
    </div>
  );
}
