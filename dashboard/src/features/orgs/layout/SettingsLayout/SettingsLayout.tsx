import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import type { ProjectLayoutProps } from '@/features/orgs/layout/ProjectLayout';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useTheme } from '@mui/material';
import { twMerge } from 'tailwind-merge';

export interface SettingsLayoutProps extends ProjectLayoutProps {}

export default function SettingsLayout({ children }: SettingsLayoutProps) {
  const theme = useTheme();
  const { project } = useProject();
  const hasGitRepo = !!project?.githubRepository;

  return (
    <Box
      sx={{ backgroundColor: 'background.default' }}
      className="flex h-full w-full flex-auto flex-col overflow-y-auto overflow-x-hidden"
    >
      <Box
        sx={{ backgroundColor: 'background.default' }}
        className="flex h-full flex-col"
      >
        <RetryableErrorBoundary>
          <div className="flex flex-col space-y-2">
            {hasGitRepo && (
              <Alert
                severity="info"
                className="mb-4 rounded-lg border border-primary/20 bg-primary/8"
              >
                <div className="flex flex-col gap-2">
                  <div>
                    <Text className="text-sm">
                      <span className="font-medium text-primary">GitHub Repository Connected</span>
                      <br />
                      <span className="mt-1.5 block text-xs text-gray-600 dark:text-gray-400">
                        Make sure to run{' '}
                        <code
                          className={twMerge(
                            'rounded bg-primary/10 px-1.5 py-0.5 font-mono text-xs',
                            theme.palette.mode === 'dark'
                              ? 'text-primary'
                              : 'text-primary-dark',
                          )}
                        >
                          nhost config pull
                        </code>
                        {' '}to sync your changes
                        <br />
                        <br />
                        If you want to connect multiple projects to the same
                        repository, you can use {' '}
                        <a
                          href="https://docs.nhost.io/platform/cli/configuration-overlays"
                          target="_blank"
                          className="text-xs text-primary hover:text-primary-dark"
                        >
                          configuration overlays
                        </a>
                       
                      </span>
                    </Text>
                  </div>
                </div>
              </Alert>
            )}
          </div>
          {children}
        </RetryableErrorBoundary>
      </Box>
    </Box>
  );
}
