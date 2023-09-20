import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ContactUsProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {}

export default function FeedbackForm({ className, ...props }: ContactUsProps) {
  return (
    <div
      className={twMerge(
        'grid max-w-md grid-flow-row gap-2 py-4 px-5',
        className,
      )}
      {...props}
    >
      <Text variant="h3" component="h2">
        Contact us
      </Text>

      <Text>
        To report issues with Nhost, please open a GitHub issue in the{' '}
        <Link
          href="https://github.com/nhost/nhost/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          nhost/nhost
        </Link>{' '}
        repository.
      </Text>
      <Text>
        For issues related to the CLI, please visit the{' '}
        <Link
          href="https://github.com/nhost/cli/issues/new"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          nhost/cli
        </Link>{' '}
        repository.
      </Text>
      <Text>
        If you need assistance or have any questions, feel free to join us on{' '}
        <Link
          href="https://discord.com/invite/9V7Qb2U"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          Discord
        </Link>
        . Alternatively, if you prefer, you can also open a{' '}
        <Link
          href="https://github.com/nhost/nhost/discussions/new/choose"
          target="_blank"
          rel="noopener noreferrer"
          underline="hover"
        >
          GitHub discussion
        </Link>
        .
      </Text>
      <Text>We&apos;re here to help, so don&apos;t hesitate to reach out!</Text>
    </div>
  );
}
