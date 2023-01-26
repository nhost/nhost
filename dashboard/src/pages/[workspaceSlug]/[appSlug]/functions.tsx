import { FunctionsNotDeployed } from '@/components/applications/functions/FunctionsNotDeployed';
import { normalizeFunctionMetadata } from '@/components/applications/functions/normalizeFunctionMetadata';
import Container from '@/components/layout/Container';
import ProjectLayout from '@/components/layout/ProjectLayout';
import { useWorkspaceContext } from '@/context/workspace-context';
import { useCurrentWorkspaceAndApplication } from '@/hooks/useCurrentWorkspaceAndApplication';
import Status, { StatusEnum } from '@/ui/Status';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import ChevronRightIcon from '@/ui/v2/icons/ChevronRightIcon';
import FolderIcon from '@/ui/v2/icons/FolderIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import generateAppServiceUrl from '@/utils/common/generateAppServiceUrl';
import { useGetAppFunctionsMetadataQuery } from '@/utils/__generated__/graphql';
import clsx from 'clsx';
import Image from 'next/image';
import NavLink from 'next/link';
import type { ReactElement } from 'react';
import { Fragment, useEffect, useState } from 'react';
import { twMerge } from 'tailwind-merge';

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
      <Text className="mt-4 text-lg font-medium">Function Logs</Text>
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
      <Container className="grid items-center pt-12 text-center">
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
        <Text color="error">{error.message}</Text>
      </Container>
    );
  }

  return (
    <Container>
      <div className="mt-2">
        {normalizedFunctions?.map((folder) => (
          <Box key={folder.folder}>
            <div
              className={twMerge(
                'flex flex-row pt-8 pb-2 align-middle',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              <div className="flex w-full">
                {folder.nestedLevel > 0 && (
                  <FolderIcon
                    className="h-4 w-4 self-center align-middle"
                    sx={{ color: 'text.disabled' }}
                  />
                )}
                <Text
                  className={twMerge(
                    'text-xs font-medium',
                    folder.nestedLevel > 0 && 'ml-2',
                  )}
                >
                  {folder.folder}/
                </Text>
              </div>
              {folder.nestedLevel === 0 ? (
                <div className="flex w-full flex-row">
                  <div className="flex w-52">
                    <Text className="text-xs font-medium">Created At</Text>
                  </div>
                  <div className="flex w-16 self-end">
                    <Text className="text-xs font-medium">Status</Text>
                  </div>
                </div>
              ) : null}
            </div>
            <Box
              className={clsx(
                'border-t',
                folder.nestedLevel < 2 && 'ml-6',
                folder.nestedLevel >= 2 && 'ml-12',
              )}
            >
              <List>
                {folder.funcs.map((func) => (
                  <Fragment key={func.id}>
                    <ListItem.Root>
                      <NavLink
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
                        <ListItem.Button className="flex flex-row items-center rounded-none">
                          <div className="flex w-full flex-row items-center">
                            <Image
                              src={`/assets/functions/${func.lang}.svg`}
                              alt={`Logo of ${func.lang}`}
                              width={16}
                              height={16}
                            />

                            <Text className="pl-2 font-medium">
                              {func.name}
                            </Text>
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
                        </ListItem.Button>
                      </NavLink>
                    </ListItem.Root>
                    <Divider component="li" />
                  </Fragment>
                ))}
              </List>
            </Box>
          </Box>
        ))}
      </div>

      <div className="mx-auto mt-10 max-w-6xl text-center">
        <Text className="text-xs font-medium">
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
