import { InfoIcon } from 'lucide-react';
import { forwardRef } from 'react';
import type { UseFormRegisterReturn } from 'react-hook-form';
import { Input } from '@/components/ui/v3/input';
import { TextLink } from '@/components/ui/v3/text-link';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/v3/tooltip';

type LogsRegexFilterProps = UseFormRegisterReturn<
  keyof {
    regexFilter: string;
  }
>;

const LogsRegexFilter = forwardRef<HTMLInputElement, LogsRegexFilterProps>(
  (props, ref) => (
    <div className="relative flex w-full min-w-0 items-center">
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label="Info"
            className="absolute left-2 z-10 cursor-pointer rounded-full"
          >
            <InfoIcon className="h-5 w-5 text-blue-500" />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[30rem]">
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
                to search for lines with the word <b>error</b> (case sensitive)
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
        </TooltipContent>
      </Tooltip>
      <Input
        {...props}
        ref={ref}
        placeholder="Search logs with a regular expression"
        autoComplete="off"
        className="min-w-[20rem] pl-9"
      />
    </div>
  ),
);

export default LogsRegexFilter;
