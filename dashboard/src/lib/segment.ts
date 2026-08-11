import { AnalyticsBrowser, type ID } from '@segment/analytics-next';
import { isPlatform } from '@/utils/env';
import { isDevOrStaging } from '@/utils/helpers';

export const analytics = AnalyticsBrowser.load(
  {
    writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
  },
  {
    disable: !isPlatform() || isDevOrStaging(),
  },
);

export async function getAnonId(): Promise<ID> {
  const timeout = new Promise<undefined>((resolve) => {
    setTimeout(() => resolve(undefined), 300);
  });

  try {
    return await Promise.race([
      analytics
        .user()
        .then((user) => user.anonymousId())
        .catch(() => undefined),
      timeout,
    ]);
  } catch (err) {
    console.error('Failed to get anonymous ID:', err);
    return undefined;
  }
}
