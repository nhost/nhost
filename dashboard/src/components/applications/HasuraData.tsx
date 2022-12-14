import { ConnectionDetail } from '@/components/applications/ConnectionDetail';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import useIsPlatform from '@/hooks/common/useIsPlatform';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Button from '@/ui/v2/Button';
import ArrowSquareOutIcon from '@/ui/v2/icons/ArrowSquareOutIcon';
import Link from '@/ui/v2/Link';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl, {
  defaultLocalBackendSlugs,
  defaultRemoteBackendSlugs,
} from '@/utils/common/generateAppServiceUrl';
import { LOCAL_HASURA_URL } from '@/utils/env';
import Image from 'next/image';

interface HasuraDataProps {
  close?: () => void;
}

export function HasuraData({ close }: HasuraDataProps) {
  const { currentApplication } = useCurrentWorkspaceAndApplication();
  const isPlatform = useIsPlatform();

  if (
    !currentApplication?.subdomain ||
    !currentApplication?.hasuraGraphqlAdminSecret
  ) {
    return <LoadingScreen />;
  }

  const hasuraUrl =
    process.env.NEXT_PUBLIC_ENV === 'dev' || !isPlatform
      ? `${LOCAL_HASURA_URL}/console`
      : generateAppServiceUrl(
          currentApplication?.subdomain,
          currentApplication?.region.awsName,
          'hasura',
          defaultLocalBackendSlugs,
          { ...defaultRemoteBackendSlugs, hasura: '/console' },
        );

  return (
    <div className="mx-auto w-full max-w-md px-6 py-4 text-left">
      <div className="grid grid-flow-row gap-1">
        <div className="mx-auto">
          <Image
            src="/assets/hasuramodal.svg"
            width={72}
            height={72}
            alt="Hasura"
          />
        </div>

        <Text variant="h3" component="h1" className="text-center">
          Open Hasura
        </Text>

        <Text className="text-center">
          Hasura is the dashboard you&apos;ll use to edit your schema and
          permissions as well as browse data. Copy the admin secret to your
          clipboard and enter it in the next screen.
        </Text>

        <div className="mt-6 divide-y-1 divide-divide border-t-1 border-b-1">
          {/* @FIX: Get deployment version from Backend. #NHOST-262 */}
          <ConnectionDetail
            title="Admin Secret"
            value={currentApplication.hasuraGraphqlAdminSecret}
          />
        </div>

        <div className="mt-6 grid grid-flow-row gap-2">
          <Link
            href={hasuraUrl}
            target="_blank"
            rel="noreferrer noopener"
            className="grid grid-flow-col items-center justify-center gap-1 rounded-[4px] bg-btn p-2 text-sm+ font-medium text-white hover:ring-2 motion-safe:transition-all"
            underline="none"
          >
            Open Hasura
            <ArrowSquareOutIcon className="h-4 w-4" />
          </Link>

          {close && (
            <Button
              variant="outlined"
              color="secondary"
              className="text-grayscaleDark text-sm+ font-normal"
              onClick={close}
            >
              Cancel
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

export default HasuraData;
