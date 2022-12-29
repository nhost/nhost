export type UserSecurityKey = {
  id: string;
  user_id?: string;
  counter: number;
  credential_id: string;
  credential_public_key: string;
  transports?: string;
  nickname?: string;
};

export type SqlUser = {
  id: string;
  created_at: Date;
  display_name: string;
  new_email: string | null;
  avatar_url: string;
  locale: string;
  email: string;
  is_anonymous: boolean;
  default_role: string;
  totp_secret?: string;
  disabled: boolean;
  otp_hash: string | null;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  metadata?: any;
  email_verified: boolean;
  phone_number?: string;
  phone_number_verified: boolean;
  active_mfa_type: string | null;
  roles: string[];
  ticket: string | null;
  password_hash: string | null;
  webauthn_current_challenge: string | null;
  ticket_expires_at?: Date;
  otp_method_last_used?: string;
  otp_hash_expires_at?: Date;
  last_seen: Date;
};
