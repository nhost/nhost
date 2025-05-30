import { Box } from '@/components/ui/v2/Box';
import { InfoIcon } from '@/components/ui/v2/icons/InfoIcon';
import { Input } from '@/components/ui/v2/Input';
import { Link } from '@/components/ui/v2/Link';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { forwardRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';

type LogsRegexFilterProps = UseFormRegisterReturn<
  keyof {
    regexFilter: string;
  }
>;

const LogsRegexFilter = forwardRef<HTMLInputElement, LogsRegexFilterProps>(
  (props, ref) => (
    <Input
      {...props}
      ref={ref}
      placeholder="Filter logs with a regular expression"
      hideEmptyHelperText
      autoComplete="off"
      fullWidth
      className="min-w-80"
      startAdornment={
        <Tooltip
          componentsProps={{
            tooltip: {
              sx: {
                maxWidth: '30rem',
              },
            },
          }}
          title={
            <div className="space-y-4 p-2">
              <h2>Here are some useful regular expressions:</h2>
              <ul className="list-disc space-y-2 pl-3">
                <li>
                  use
                  <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                    (?i)error
                  </code>
                  to search for lines with the word <b>error</b> (case
                  insensitive)
                </li>
                <li>
                  use
                  <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                    error
                  </code>
                  to search for lines with the word <b>error</b> (case
                  sensitive)
                </li>
                <li>
                  use
                  <code className="mx-1 rounded-md bg-slate-500 px-1 py-px text-slate-100">
                    /metadata.*error
                  </code>
                  to search for errors in hasura&apos;s metadata endpoint
                </li>
                <li>
                  See
                  <Link
                    href="https://github.com/google/re2/wiki/Syntax"
                    target="_blank"
                    rel="noopener noreferrer"
                    underline="hover"
                    className="mx-1"
                  >
                    here
                  </Link>
                  for more patterns
                </li>
              </ul>
            </div>
          }
        >
          <Box className="ml-2 cursor-pointer rounded-full">
            <InfoIcon aria-label="Info" className="h-5 w-5" color="info" />
          </Box>
        </Tooltip>
      }
    />
  ),
);

export default LogsRegexFilter;
