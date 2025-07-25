import { RetryableErrorBoundary } from '@/components/presentational/RetryableErrorBoundary';
import { Alert } from '@/components/ui/v2/Alert';
import { Box } from '@/components/ui/v2/Box';
import { Text } from '@/components/ui/v2/Text';
import { useProject } from '@/features/orgs/projects/hooks/useProject';
import { useSettingsDisabled } from '@/hooks/useSettingsDisabled';
import { useTheme } from '@mui/material';
import { useRouter } from 'next/router';
import type { PropsWithChildren } from 'react';
import { useEffect } from 'react';
import { twMerge } from 'tailwind-merge';

export default function SettingsLayout({ children }: PropsWithChildren) {
  const theme = useTheme();
  const { project } = useProject();
  const hasGitRepo = !!project?.githubRepository;
  const isSettingsDisabled = useSettingsDisabled();
  const router = useRouter();

  useEffect(() => {
    if (isSettingsDisabled) {
      router.push('/404');
    }
  }, [router, isSettingsDisabled]);

  if (isSettingsDisabled) {
    return null;
  }

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
                className="bg-primary/8 mb-4 rounded-lg border border-primary/20"
              >
                <div className="flex flex-col gap-2">
                  <div>
                    <Text className="text-sm">
                      <span className="font-medium text-primary">
                        GitHub Repository Connected
                      </span>
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
                        </code>{' '}
                        to sync your changes
                        <br />
                        <br />
                        If you want to connect multiple projects to the same
                        repository, you can use{' '}
                        <a
                          href="https://docs.nhost.io/platform/cli/configuration-overlays"
                          target="_blank"
                          rel="noreferrer"
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
