import { FunctionsLogsTerminalPage } from '@/components/applications/functions/FunctionLogsTerminalFromPage';
import type { Func } from '@/components/applications/functions/normalizeFunctionMetadata';
import { normalizeFunctionMetadata } from '@/components/applications/functions/normalizeFunctionMetadata';
import { LoadingScreen } from '@/components/common/LoadingScreen';
import Help from '@/components/icons/Help';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import { useGetAllUserWorkspacesAndApplications } from '@/hooks/useGetAllUserWorkspacesAndApplications';
import { Text } from '@/ui/Text';
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
        <h1 className="text-4xl font-semibold text-greyscaleDark">Not found</h1>
        <p className="text-sm text-greyscaleGrey">
          This function does not exist.
        </p>
      </Container>
    );
  }

  return (
    <>
      <Container>
        <div className="flex place-content-between">
          <div className="flex flex-row items-center py-1">
            <Image
              src={`/assets/functions/${
                currentFunction.name.split('.')[1]
              }.svg`}
              alt={`Logo of ${currentFunction.name.split('.')[1]}`}
              width={40}
              height={40}
            />

            <div className="flex flex-col">
              <Text
                color="greyscaleDark"
                variant="body"
                className="ml-2 font-medium"
                size="big"
              >
                {currentFunction.name}
              </Text>
              <a
                className="ml-2 text-xs font-medium text-greyscaleGrey"
                href={`${generateAppServiceUrl(
                  currentApplication.subdomain,
                  currentApplication.region.awsName,
                  'functions',
                )}${currentFunction?.route}`}
                target="_blank"
                rel="noreferrer"
              >
                {`${generateAppServiceUrl(
                  currentApplication.subdomain,
                  currentApplication.region.awsName,
                  'functions',
                )}${currentFunction?.route}`}
              </a>
            </div>
          </div>
        </div>
      </Container>

      <Container className="pt-10">
        <div className="flex flex-row place-content-between">
          <div className="flex">
            <Text size="large" className="font-medium" color="greyscaleDark">
              Log
            </Text>
          </div>
          <div className="flex">
            <Text
              size="tiny"
              className="self-center font-medium"
              color="greyscaleDark"
            >
              Awaiting new requests…
            </Text>
            <a
              href="https://docs.nhost.io/platform/serverless-functions"
              target="_blank"
              rel="noreferrer"
            >
              <Help className="h-7 w-7" />
            </a>
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
