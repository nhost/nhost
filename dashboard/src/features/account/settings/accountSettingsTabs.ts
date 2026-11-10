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
  general: { title: 'General', icon: UserRound },
  authentication: { title: 'Authentication', icon: ShieldCheck },
  sessions: { title: 'Sessions', icon: MonitorSmartphone },
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
  { label: 'Security', tabs: ['authentication', 'sessions'] },
  { label: 'Developer', tabs: ['personal-access-tokens'] },
];

/** The sections of the Authentication page, used as anchors. */
export type AuthenticationSection =
  | 'password'
  | 'two-factor-authentication'
  | 'security-keys'
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
