import { linkToken, readLinkError } from '@/lib/nhost/linkToken';

type AuthStart = {
  // Reads the stored session into memory. Must not throw.
  hydrate: () => Promise<void>;
  // The deep link the app was opened with, or null.
  initialURL: () => Promise<string | null>;
  // Calls back with every deep link that arrives while the app is running,
  // and returns what stops it.
  listen: (onURL: (url: string) => void) => () => void;
  // Turns a link's token into a session. Must not throw.
  redeem: (url: string) => Promise<void>;
  onLoading: (isLoading: boolean) => void;
  // Why the latest link did not sign anyone in, or null for one carrying a
  // token instead.
  onLinkError: (message: string | null) => void;
};

/**
 * Reads the stored session, then redeems the link the app was opened with,
 * then every link that arrives after it, one at a time, and reports through
 * `onLoading` whether any of that is still running. A link carrying an error
 * from the auth service instead of a token takes its turn the same way, so a
 * later link's answer always replaces an earlier one's, and the error is in
 * place by the time loading ends.
 *
 * Each step can change who is signed in, so nothing should decide until the
 * last one has finished. A screen that decided during a redemption would treat
 * someone who is being signed in as signed out: the protected screen would
 * send them to sign in, and the reset screen would call a working link
 * expired. One at a time because the disk read assigns the session outright,
 * and a redemption that finished first would be overwritten by it.
 *
 * Returns what stops it. A step that has not started by then never does.
 */
export function startAuth({
  hydrate,
  initialURL,
  listen,
  redeem,
  onLoading,
  onLinkError,
}: AuthStart): () => void {
  let stopped = false;
  let pending = 0;
  let queue = Promise.resolve();
  let last: string | null = null;

  const run = (step: () => Promise<void>): void => {
    pending += 1;
    onLoading(true);

    queue = queue
      .then(() => (stopped ? undefined : step()))
      .catch((err) => {
        console.error('Could not finish signing in:', err);
      })
      .finally(() => {
        pending -= 1;

        if (pending === 0 && !stopped) {
          onLoading(false);
        }
      });
  };

  // A link with neither a token nor an error is only navigation and leaves the
  // session as it is. The one just taken is skipped too: its token is single
  // use. A link that only carried an error spent nothing, so it is not
  // remembered, and opening it again says so again. Each link replaces the
  // error the one before it left. One carrying an error is not redeemed even
  // if it has a token too: the service never sends both, so somebody else put
  // that link together.
  const take = (url: string | null): void => {
    if (!url || url === last) {
      return;
    }

    const error = readLinkError(url);

    if (!error && !linkToken(url)) {
      return;
    }

    if (!error) {
      last = url;
    }

    run(async () => {
      onLinkError(error);

      if (!error) {
        await redeem(url);
      }
    });
  };

  // Subscribed before anything is awaited, so a link that arrives during
  // launch waits its turn instead of being missed.
  const unlisten = listen(take);

  run(hydrate);
  run(async () => take(await initialURL()));

  return () => {
    stopped = true;
    unlisten();
  };
}
