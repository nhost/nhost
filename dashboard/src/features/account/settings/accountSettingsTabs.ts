import {
  FingerprintPattern,
  KeySquare,
  Link2,
  Lock,
  type LucideIcon,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

export type AccountSettingsTab =
  | 'general'
  | 'password'
  | 'two-factor-authentication'
  | 'security-keys'
  | 'connected-accounts'
  | 'personal-access-tokens';

export const ACCOUNT_SETTINGS_DEFAULT_TAB: AccountSettingsTab = 'general';

export const ACCOUNT_SETTINGS_TABS: Record<
  AccountSettingsTab,
  { title: string; icon: LucideIcon }
> = {
  general: { title: 'General', icon: UserRound },
  password: { title: 'Password', icon: Lock },
  'two-factor-authentication': {
    title: 'Two-factor authentication',
    icon: ShieldCheck,
  },
  'security-keys': { title: 'Security keys', icon: FingerprintPattern },
  'connected-accounts': { title: 'Connected accounts', icon: Link2 },
  'personal-access-tokens': {
    title: 'Personal access tokens',
    icon: KeySquare,
  },
};

/**
 * The account settings menu, shared by the page sidebar (with the labels) and
 * the avatar menu (separators only).
 */
export const ACCOUNT_SETTINGS_GROUPS: {
  label: string;
  tabs: AccountSettingsTab[];
}[] = [
  { label: 'Account', tabs: ['general'] },
  {
    label: 'Security',
    tabs: [
      'password',
      'two-factor-authentication',
      'security-keys',
      'connected-accounts',
    ],
  },
  { label: 'Developer', tabs: ['personal-access-tokens'] },
];

/** Same `?tab=` links as the project settings pages. */
export function getAccountSettingsHref(tab: AccountSettingsTab) {
  return `/account?tab=${tab}`;
}
