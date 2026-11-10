import {
  KeySquare,
  type LucideIcon,
  MonitorSmartphone,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

export type AccountSettingsTab =
  | 'general'
  | 'authentication'
  | 'sessions'
  | 'personal-access-tokens';

export const ACCOUNT_SETTINGS_DEFAULT_TAB: AccountSettingsTab = 'general';

export const ACCOUNT_SETTINGS_TABS: Record<
  AccountSettingsTab,
  { title: string; icon: LucideIcon }
> = {
  general: { title: 'Profile', icon: UserRound },
  authentication: { title: 'Authentication', icon: ShieldCheck },
  sessions: { title: 'Sessions', icon: MonitorSmartphone },
  'personal-access-tokens': {
    title: 'Personal access tokens',
    icon: KeySquare,
  },
};

/**
 * The account settings sidebar menu, in groups.
 */
export const ACCOUNT_SETTINGS_GROUPS: {
  label: string;
  tabs: AccountSettingsTab[];
}[] = [
  { label: 'Account', tabs: ['general'] },
  // Tokens sign in as you, so they sit with the other ways in.
  {
    label: 'Security',
    tabs: ['authentication', 'sessions', 'personal-access-tokens'],
  },
];

/**
 * The avatar menu: one door per sidebar group, named by what you find there.
 * Each one lights up on every page of its group.
 */
export const ACCOUNT_MENU_LINKS: {
  title: string;
  tab: AccountSettingsTab;
  activeTabs: AccountSettingsTab[];
}[] = [
  { title: 'Profile', tab: 'general', activeTabs: ['general'] },
  {
    title: 'Security',
    tab: 'authentication',
    activeTabs: ['authentication', 'sessions', 'personal-access-tokens'],
  },
];

/** The sections of the Authentication page, used as anchors. */
export type AuthenticationSection =
  | 'password'
  | 'two-factor-authentication'
  | 'passkeys'
  | 'connected-accounts';

/**
 * Same `?tab=` links as the project settings pages. A section adds an anchor
 * so the link scrolls to that card on the Authentication page.
 */
export function getAccountSettingsHref(
  tab: AccountSettingsTab,
  section?: AuthenticationSection,
) {
  return `/account?tab=${tab}${section ? `#${section}` : ''}`;
}
