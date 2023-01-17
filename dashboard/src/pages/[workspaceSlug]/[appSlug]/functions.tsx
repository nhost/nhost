import { FunctionsNotDeployed } from '@/components/applications/functions/FunctionsNotDeployed';
import { normalizeFunctionMetadata } from '@/components/applications/functions/normalizeFunctionMetadata';
import Folder from '@/components/icons/Folder';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Status, { StatusEnum } from '@/ui/Status';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';
import clsx from 'clsx';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';
import { useEffect, useState } from 'react';

function FunctionsNoRepo() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();

  return (
    <>
      <div className="mx-auto flex w-centImage flex-col text-center">
        <Image
          src="/assets/githubRepo.svg"
          width={72}
          height={72}
          alt="GitHub Logo"
        />
      </div>
      <Text className="mt-4 font-medium text-lg">Function Logs</Text>
      <div className="flex">
        <div className="mx-auto flex flex-row self-center text-center">
          <Text className="mt-1">
            To deploy serverless functions, you need to connect your project to
            version control.
          </Text>
        </div>
      </div>
      <div className="mt-3 flex text-center">
        <NavLink
          href={`/${currentWorkspace.slug}/${currentApplication.slug}/settings/git`}
          passHref
        >
          <Button variant="borderless" className="mx-auto font-medium">
            Connect your Project to GitHub
          </Button>
        </NavLink>
      </div>
    </>
  );
}

export default function FunctionsPage() {
  const { currentWorkspace, currentApplication } =
    useCurrentWorkspaceAndApplication();
  const { workspaceContext } = useWorkspaceContext();

  const { data, loading, error } = useGetAppFunctionsMetadataQuery({
    variables: { id: currentApplication?.id },
  });

  const [normalizedFunctions, setNormalizedFunctions] = useState(null);

  useEffect(() => {
    if (!data) {
      return;
    }
    if (data.app.metadataFunctions) {
      setNormalizedFunctions(
        normalizeFunctionMetadata(data.app.metadataFunctions),
      );
    }
  }, [data]);

  if (!workspaceContext.repository) {
    return (
      <Container className="mt-12 max-w-3xl text-center antialiased">
        <FunctionsNoRepo />
      </Container>
    );
  }

  if (loading) {
    return (
      <Container className="pt-12 text-center grid items-center">
        <ActivityIndicator delay={500} />
      </Container>
    );
  }

  if (!data || normalizedFunctions === null) {
    return (
      <Container>
        <FunctionsNotDeployed />
      </Container>
    );
  }

  if (error) {
    return (
      <Container>
        <Text sx={{ color: 'error.main' }}>{error.message}</Text>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mt-2">
        {normalizedFunctions?.map((folder) => (
          <div key={folder.folder}>
            <div
              className={clsx(
                'flex flex-row pt-8 pb-2 align-middle',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              <div className={clsx('flex w-full')}>
                {folder.nestedLevel > 0 && (
                  <Folder className="self-center align-middle text-greyscaleGrey" />
                )}
                <Text
                  className={clsx(
                    'font-medium text-xs',
                    folder.nestedLevel > 0 && 'ml-2',
                  )}
                >
                  {folder.folder}/
                </Text>
              </div>
              {folder.nestedLevel === 0 ? (
                <div className="flex w-full flex-row">
                  <div className="flex w-52">
                    <Text className="font-medium text-xs">Created At</Text>
                  </div>
                  <div className="flex w-16 self-end">
                    <Text className="font-medium text-xs">Status</Text>
                  </div>
                </div>
              ) : null}
            </div>
            <Box
              className={clsx(
                'border-t py-1',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              {folder.funcs.map((func) => (
                <NavLink
                  key={func.id}
                  href={{
                    pathname:
                      '/[workspaceSlug]/[appSlug]/functions/[functionId]',
                    query: {
                      workspaceSlug: currentWorkspace.slug,
                      appSlug: currentApplication.slug,
                      functionId: func.functionName,
                    },
                  }}
                  passHref
                >
                  <a
                    href="[workspaceSlug]/[appSlug]/functions/[functionId]"
                    className={clsx(
                      'flex cursor-pointer flex-row border-b py-2.5',
                      folder.nestedLevel && 'ml-0',
                    )}
                  >
                    <div className="flex w-full flex-row items-center">
                      <Image
                        src={`/assets/functions/${func.lang}.svg`}
                        alt={`Logo of ${func.lang}`}
                        width={16}
                        height={16}
                      />

                      <Text className="pl-2 font-medium">{func.name}</Text>
                    </div>
                    <div className="flex w-full flex-row">
                      <div className={clsx('flex w-52 self-center')}>
                        <Text className="text-xs">
                          {func.formattedCreatedAt || '-'}
                        </Text>
                      </div>
                      <div className="flex w-16 self-center">
                        <Status status={StatusEnum.Live}>Live</Status>

                        <ChevronRightIcon className="ml-2 h-4 w-4 self-center" />
                      </div>
                    </div>
                  </a>
                </NavLink>
              ))}
            </Box>
          </div>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl text-center">
        <Text className="font-medium text-xs">
          Base URL for function endpoints is{' '}
          {generateAppServiceUrl(
            currentApplication.subdomain,
            currentApplication.region.awsName,
            'functions',
          )}
        </Text>
      </div>
    </Container>
  );
}

FunctionsPage.getLayout = function getLayout(page: ReactElement) {
  return <ProjectLayout>{page}</ProjectLayout>;
};
