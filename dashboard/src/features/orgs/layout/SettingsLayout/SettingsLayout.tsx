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
      className="flex flex-col flex-auto w-full h-full overflow-x-hidden overflow-y-auto"
    >
      <Box
        sx={{ backgroundColor: 'background.default' }}
        className="flex flex-col h-full"
      >
        <RetryableErrorBoundary>
          <div className="flex flex-col space-y-2">
            {hasGitRepo && (
              <Alert
                severity="warning"
                className="grid grid-flow-row gap-2 place-content-center"
              >
                <Text color="warning" className="text-sm">
                  As you have a connected repository, make sure to synchronize
                  your changes with{' '}
                  <code
                    className={twMerge(
                      'rounded-md px-2 py-px',
                      theme.palette.mode === 'dark'
                        ? 'bg-brown text-copper'
                        : 'bg-slate-200 text-slate-700',
                    )}
                  >
                    nhost config pull
                  </code>{' '}
                  or they may be reverted with the next push.
                  <br />
                  If there are multiple projects linked to the same repository
                  and you only want these changes to apply to a subset of them,
                  please check out{' '}
                  <a
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline"
                    href="https://docs.nhost.io/cli/overlays"
                  >
                    docs.nhost.io/cli/overlays
                  </a>{' '}
                  for guidance.
                </Text>
              </Alert>
            )}
          </div>
          {children}
        </RetryableErrorBoundary>
      </Box>
    </Box>
  );
}
