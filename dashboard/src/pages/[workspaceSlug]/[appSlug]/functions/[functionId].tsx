import { FunctionsLogsTerminalPage } from '@/components/applications/functions/FunctionLogsTerminalFromPage';
import type { Func } from '@/components/applications/functions/normalizeFunctionMetadata';
import { normalizeFunctionMetadata } from '@/components/applications/functions/normalizeFunctionMetadata';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import IconButton from '@/ui/v2/IconButton';
import QuestionMarkCircleIcon from '@/ui/v2/icons/QuestionMarkCircleIcon';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { yieldFunction } from '@/utils/helpers';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';
import Image from 'next/image';
import { useRouter } from 'next/router';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

export default function FunctionDetailsPage() {
  const { currentApplication, currentWorkspace } =
    useCurrentWorkspaceAndApplication();
  useGetAllUserWorkspacesAndApplications(false);

  const { data, loading, error } = useGetAppFunctionsMetadataQuery({
    variables: { id: currentApplication?.id },
  });

  const [currentFunction, setCurrentFunction] = useState<Func | null>(null);

  const router = useRouter();

  // currentFunction will be null until we get data back from remote and we set it to be the function we're looking for.
  useEffect(() => {
    if (!data) {
      return;
    }
    const appFunctions = normalizeFunctionMetadata(data?.app.metadataFunctions);
    setCurrentFunction(yieldFunction(appFunctions, router));
  }, [data, router]);

  if (!currentApplication || !currentWorkspace || loading) {
    return <LoadingScreen />;
  }

  if (error) {
    throw new Error(
      error.message ||
        'An unexpected error has ocurred. Please try again later.',
    );
  }

  if (!currentFunction) {
    return (
      <Container>
        <Text variant="h1" className="text-4xl font-semibold">
          Not found
        </Text>
        <Text className="text-sm" color="disabled">
          This function does not exist.
        </Text>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <div className="flex place-content-between">
          <div className="grid grid-flow-col items-center gap-2 py-1">
            <Image
              src={`/assets/functions/${
                currentFunction.name.split('.')[1]
              }.svg`}
              alt={`Logo of ${currentFunction.name.split('.')[1]}`}
              width={40}
              height={40}
            />

            <div className="grid grid-flow-row justify-start">
              <Text className="text-2xl font-medium">
                {currentFunction.name}
              </Text>

              <a
                href={`${generateAppServiceUrl(
                  currentApplication.subdomain,
                  currentApplication.region.awsName,
                  'functions',
                )}${currentFunction?.route}`}
                target="_blank"
                rel="noreferrer"
              >
                <Text className="text-xs font-medium" color="disabled">
                  {`${generateAppServiceUrl(
                    currentApplication.subdomain,
                    currentApplication.region.awsName,
                    'functions',
                  )}${currentFunction?.route}`}
                </Text>
              </a>
            </div>
          </div>
        </div>
      </Container>

      <Container>
        <div className="flex flex-row place-content-between">
          <div className="flex">
            <Text className="text-xl font-medium">Log</Text>
          </div>
          <div className="flex items-center">
            <Text className="text-xs font-medium">Awaiting new requests…</Text>

            <IconButton
              variant="borderless"
              href="https://docs.nhost.io/platform/serverless-functions"
              // Both `target` and `rel` are available when `href` is set. This is
              // a limitation of MUI.
              // @ts-ignore
              target="_blank"
              rel="noreferrer"
              aria-label="Learn more about serverless functions"
            >
              <QuestionMarkCircleIcon className="h-7 w-7" />
            </IconButton>
          </div>
        </div>

        <div className="mt-5">
          <FunctionsLogsTerminalPage functionName={currentFunction?.path} />
        </div>
      </Container>
    </>
  );
}

FunctionDetailsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
