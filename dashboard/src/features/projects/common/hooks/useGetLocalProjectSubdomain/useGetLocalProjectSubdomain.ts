import { useIsPlatform } from '@/features/projects/common/hooks/useIsPlatform';
import { useRouter } from 'next/router';

/**
 * Returns the (dynamic) subdomain when running the CLI.
 */
export default function useGetLocalProjectSubdomain() {
  const { pathname } = useRouter();
  const isPlatform = useIsPlatform();

  const domainAndSubdomain = pathname.split('/')[2];

  const subdomain = domainAndSubdomain.split('.')[0];

  if (subdomain.split('-').length === 4) {
    return subdomain;
  }
  return 'local';
}
