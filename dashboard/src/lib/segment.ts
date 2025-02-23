import { AnalyticsBrowser } from "@segment/analytics-next";

export const analytics = AnalyticsBrowser.load({
	cdnURL: process.env.NEXT_PUBLIC_SEGMENT_CDN_URL!,
	writeKey: process.env.NEXT_PUBLIC_ANALYTICS_WRITE_KEY!,
});
