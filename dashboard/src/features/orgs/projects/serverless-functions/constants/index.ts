import type { HttpMethod } from '@/features/orgs/projects/serverless-functions/types';

// Tailwind palette pair: light/dark text classes for inline UI, and the
// matching -500 mid-tone HSL for chart lines/swatches. Keep these in sync.
export const HTTP_METHOD_TEXT_CLASSES: Record<HttpMethod, string> = {
  GET: 'text-blue-600 dark:text-blue-400',
  POST: 'text-green-600 dark:text-green-400',
  PUT: 'text-amber-600 dark:text-amber-400',
  PATCH: 'text-pink-600 dark:text-pink-400',
  DELETE: 'text-red-600 dark:text-red-400',
  OPTIONS: 'text-purple-600 dark:text-purple-400',
  HEAD: 'text-teal-600 dark:text-teal-400',
};

export const HTTP_METHOD_CHART_COLORS: Record<HttpMethod, string> = {
  GET: 'hsl(217 91% 60%)',
  POST: 'hsl(142 71% 45%)',
  PUT: 'hsl(38 92% 50%)',
  PATCH: 'hsl(330 81% 60%)',
  DELETE: 'hsl(0 84% 60%)',
  OPTIONS: 'hsl(271 91% 65%)',
  HEAD: 'hsl(173 80% 40%)',
};
