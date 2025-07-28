import { isPlatform } from '@/utils/env';
import { isDevOrStaging } from '@/utils/helpers';
import { AnalyticsBrowser } from '@segment/analytics-next';


export const analytics = AnalyticsBrowser.load(
  {
    cdnURL: process.env.NEXT_PUBLIC_SEGMENT_CDN_URL!,
    writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
  },
  {
    disable: !isPlatform() || isDevOrStaging()
});


export async function getAnonId() {
  let anonId: string;
  try {
    const user = await analytics.user();
    anonId = user.anonymousId();
  } catch (err) {
    console.error('Failed to get anonymous ID:', err);
  }
  return anonId;
}
