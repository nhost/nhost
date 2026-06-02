import { InfoIcon } from 'lucide-react';
import { forwardRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Box } from '@/components/ui/v2/Box';
import { Input } from '@/components/ui/v2/Input';
import { Tooltip } from '@/components/ui/v2/Tooltip';
import { TextLink } from '@/components/ui/v3/text-link';

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
      className="min-w-0"
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
                  <TextLink
                    href="https://github.com/google/re2/wiki/Syntax"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-1"
                  >
                    here
                  </TextLink>
                  for more patterns
                </li>
              </ul>
            </div>
          }
        >
          <Box className="ml-2 cursor-pointer rounded-full">
            <InfoIcon aria-label="Info" className="h-5 w-5 text-blue-500" />
          </Box>
        </Tooltip>
      }
    />
  ),
);

export default LogsRegexFilter;
