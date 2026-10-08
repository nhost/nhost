const TEXT = 'Check your inbox';

/**
 * Heads a state that is waiting on an email, and opens the local mailbox.
 *
 * Several of the auth flows get as far as "check your inbox", and against a
 * local backend that inbox is Mailhog rather than a real one. Without this a
 * developer trying the template has to know that, find the URL and paste it in
 * by hand, at exactly the point the flow is supposed to continue.
 *
 * The words only become a link while that mailbox exists. `localMailboxURL()`
 * returns null once the app targets a real project, and then they stay plain
 * text: the email went to the visitor's own inbox, so a link would be a lie
 * about where to find it.
 */
export default function CheckYourInbox({ url }: { url: string | null }) {
  if (!url) {
    return <p className="font-medium text-sm">{TEXT}</p>;
  }

  return (
    <p className="font-medium text-sm">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        className="underline underline-offset-4"
      >
        {TEXT}
      </a>
    </p>
  );
}
