import { CheckIcon } from '@/components/ui/v2/icons/CheckIcon';
import { XIcon } from '@/components/ui/v2/icons/XIcon';
import { getDesignTokens } from '@/components/ui/v2/theme/getDesignTokens';
import { COLOR_PREFERENCE_STORAGE_KEY } from '@/utils/constants/common';
import type { DefaultToastOptions } from 'react-hot-toast';

export function getToastBackgroundColor() {
  const lightTokens = getDesignTokens('light');
  const darkTokens = getDesignTokens('dark');

  if (typeof window === 'undefined') {
    return lightTokens.grey?.[700] || 'rgb(33 50 75)';
  }

  const colorMode = window.localStorage.getItem(COLOR_PREFERENCE_STORAGE_KEY);

  if (colorMode === 'dark') {
    return darkTokens.grey?.[400] || 'rgb(33 50 75)';
  }

  return lightTokens.grey?.[700] || 'rgb(33 50 75)';
}

/**
 * Common styles for `toast.promise` notifications in the settings page.
 *  @see {@link https://react-hot-toast.com/docs/toast}
 */
export const getToastStyleProps: () => DefaultToastOptions = () => ({
  style: {
    minWidth: '400px',
    backgroundColor: getToastBackgroundColor(),
    color: '#fff',
  },
  success: {
    duration: 5000,
    icon: <CheckIcon className="h-4 w-4" />,
  },
  error: {
    duration: 5000,
    icon: <XIcon className="h-4 w-4" />,
  },
});

/**
 * Default Gravatar for newly signed up users.
 * @see {@link https://en.gravatar.com/site/implement/images/}
 */
export const AUTH_GRAVATAR_DEFAULT = [
  {
    value: '404',
    label: '404',
  },
  {
    value: 'mp',
    label: 'mp',
  },
  {
    value: 'identicon',
    label: 'identicon',
  },
  {
    value: 'monsterid',
    label: 'monsterid',
  },
  {
    value: 'wavatar',
    label: 'wavatar',
  },
  {
    value: 'retro',
    label: 'retro',
  },
  {
    value: 'robohash',
    label: 'robohash',
  },
  {
    value: 'blank',
    label: 'blank',
  },
];

/**
 *  Default Gravatar Rating for newly signed up users.
 *  Gravatar allows users to self-rate their images so that they can indicate if an image is appropriate for a certain audience.
 *  @see {@link: https://en.gravatar.com/site/implement/images/}
 */
export const AUTH_GRAVATAR_RATING = [
  {
    value: 'g',
    label: 'g',
  },

  {
    value: 'pg',
    label: 'pg',
  },
  {
    value: 'r',
    label: 'r',
  },
  {
    value: 'x',
    label: 'x',
  },
];
