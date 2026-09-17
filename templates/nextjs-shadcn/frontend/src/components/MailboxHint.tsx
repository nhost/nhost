import { localMailboxURL } from '@/lib/nhost/env';

const mailbox = localMailboxURL();

/**
 * Points at the local mailbox that catches every email the backend sends.
 *
 * Meant to follow a sentence that has just told someone to go and read their
 * email, which is otherwise a dead end on a local stack: nothing was actually
 * delivered anywhere they can reach. Renders nothing when the app points at a
 * real project, where the mail does go out.
 */
export function MailboxHint() {
  if (!mailbox) {
    return null;
  }

  return (
    <>
      {' '}
      Running locally, so it never leaves your machine:{' '}
      <a
        href={mailbox}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        open the local mailbox
      </a>
      .
    </>
  );
}
