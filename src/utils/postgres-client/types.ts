export type UserSecurityKey = {
  id: string;
  user_id?: string;
  counter: number;
  credential_id: string;
  credential_public_key: string;
  transports?: string;
  nickname?: string;
};
