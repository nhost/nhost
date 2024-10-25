import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { ActivityIndicator } from '@/components/ui/v2/ActivityIndicator';
import { Box } from '@/components/ui/v2/Box';
import { Chip } from '@/components/ui/v2/Chip';
import { Divider } from '@/components/ui/v2/Divider';
import { List } from '@/components/ui/v2/List';
import { ListItem } from '@/components/ui/v2/ListItem';
import { Text } from '@/components/ui/v2/Text';
import { useCurrentWorkspaceAndProject } from '@/features/projects/common/hooks/useCurrentWorkspaceAndProject';
import { formatDistanceToNowStrict, parseISO } from 'date-fns';
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
      <Box className="flex flex-row py-4 border-y">
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
              className="w-full"
              legacyBehavior
            >
              <ListItem.Button className="grid items-center justify-between grid-flow-col gap-2">
                <div className="grid items-center justify-start grid-flow-col gap-2">
                  <ListItem.Avatar>
                    <div className="w-8 h-8 overflow-hidden rounded-lg">
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
                      project.creator ? (
                        <span>
                          {`Created by ${
                            project.creator.displayName || project.creator.email
                          } ${formatDistanceToNowStrict(
                            parseISO(project.createdAt),
                          )} ago`}
                        </span>
                      ) : undefined
                    }
                    secondaryTypographyProps={{
                      className: 'text-xs',
                    }}
                  />
                </div>

                <Chip
                  size="small"
                  label={project.legacyPlan.name}
                  color={project.legacyPlan.isFree ? 'default' : 'primary'}
                />
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
  return (
    <div className="mt-9">
      <div className="max-w-3xl mx-auto font-display">
        <div className="grid items-center justify-between grid-flow-col gap-2 mb-4">
          <Text className="text-lg font-medium">Projects</Text>
        </div>

        <RetryableErrorBoundary errorMessageProps={{ className: 'px-0' }}>
          <AllWorkspaceApps />
        </RetryableErrorBoundary>
      </div>
    </div>
  );
}
