import { Link } from '@/components/ui/v2/Link';
import { Text } from '@/components/ui/v2/Text';
import type { DetailedHTMLProps, HTMLProps } from 'react';
import { twMerge } from 'tailwind-merge';

export interface ContactUsProps
  extends DetailedHTMLProps<HTMLProps<HTMLDivElement>, HTMLDivElement> {
  isTeam?: boolean;
  isOwner?: boolean;
}

export default function FeedbackForm({
  className,
  isTeam,
  isOwner,
  ...props
}: ContactUsProps) {
  return (
    <div
      className={twMerge(
        'grid max-w-md grid-flow-row gap-2 px-5 py-4',
        className,
      )}
      {...props}
    >
      <Text variant="h3" component="h2">
        Contact us
      </Text>

      {isTeam && isOwner && (
        <Text>
          If this is a new Team project, or you need to manage members, reach
          out to us on discord or via email at{' '}
          <Link
            href="mailto:support@nhost.io"
            target="_blank"
            rel="noopener noreferrer"
            underline="hover"
          >
            support@nhost.io
          </Link>{' '}
          so we can have your dedicated channel set up.
        </Text>
      )}

      {isTeam && !isOwner && (
        <Text>
          As part of a team plan you can reach out to us on the private channel
          for this workspace. If you haven&apos;t been added to the channel, ask
          the workspace owner to add you.
        </Text>
      )}

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
