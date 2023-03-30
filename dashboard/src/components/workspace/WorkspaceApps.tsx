import RetryableErrorBoundary from '@/components/common/RetryableErrorBoundary';
import { useCurrentWorkspaceAndProject } from '@/hooks/v2/useCurrentWorkspaceAndProject';
import Status, { StatusEnum } from '@/ui/Status';
import ActivityIndicator from '@/ui/v2/ActivityIndicator';
import Box from '@/ui/v2/Box';
import Button from '@/ui/v2/Button';
import Divider from '@/ui/v2/Divider';
import PlusCircleIcon from '@/ui/v2/icons/PlusCircleIcon';
import List from '@/ui/v2/List';
import { ListItem } from '@/ui/v2/ListItem';
import Text from '@/ui/v2/Text';
import Image from 'next/image';
import NavLink from 'next/link';
import { Fragment } from 'react';

function AllWorkspaceApps() {
  const { currentWorkspace, loading, error } = useCurrentWorkspaceAndProject();

  if (loading) {
    return <ActivityIndicator label="Loading projects..." delay={1000} />;
  }

  if (error) {
    throw error;
  }

  if (currentWorkspace?.projects?.length === 0) {
    return (
      <Box className="flex flex-row border-y py-4">
        <Text className="text-xs" color="secondary">
          No projects on this workspace.
        </Text>
      </Box>
    );
  }

  return (
    <List>
      <Divider component="li" />

      {currentWorkspace?.projects.map((project) => (
        <Fragment key={project.id}>
          <ListItem.Root>
            <NavLink
              href={`${currentWorkspace?.slug}/${project.slug}`}
              passHref
            >
              <ListItem.Button className="grid grid-flow-col items-center justify-between gap-2">
                <div className="grid grid-flow-col items-center justify-start gap-2">
                  <ListItem.Avatar>
                    <div className="h-8 w-8 overflow-hidden rounded-lg">
                      <Image
                        src="/logos/new.svg"
                        alt="Nhost Logo"
                        width={32}
                        height={32}
                      />
                    </div>
                  </ListItem.Avatar>

                  <ListItem.Text
                    primary={project.name}
                    secondary={
                      project.creator
                        ? `Created by ${
                            project.creator.displayName || project.creator.email
                          }`
                        : undefined
                    }
                  />
                </div>

                <Status status={StatusEnum.Plan}>{project.plan.name}</Status>
              </ListItem.Button>
            </NavLink>
          </ListItem.Root>

          <Divider component="li" />
        </Fragment>
      ))}
    </List>
  );
}
export default function WorkspaceApps() {
  const { currentWorkspace, loading } = useCurrentWorkspaceAndProject();

  return (
    <div className="mt-9">
      <div className="mx-auto max-w-3xl font-display">
        <div className="mb-4 flex flex-row place-content-between">
          <Text className="text-lg font-medium">Projects</Text>

          {!loading && (
            <NavLink
              href={{
                pathname: '/new',
                query: { workspace: currentWorkspace?.slug },
              }}
            >
              <Button
                variant="outlined"
                color="secondary"
                startIcon={<PlusCircleIcon />}
              >
                New Project
              </Button>
            </NavLink>
          )}
        </div>

        <RetryableErrorBoundary errorMessageProps={{ className: 'px-0' }}>
          <AllWorkspaceApps />
        </RetryableErrorBoundary>
      </div>
    </div>
  );
}
