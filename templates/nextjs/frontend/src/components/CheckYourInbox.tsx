const TEXT = 'Check your inbox';

/** Heads a state that is waiting on an email, and opens the local mailbox. */
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
