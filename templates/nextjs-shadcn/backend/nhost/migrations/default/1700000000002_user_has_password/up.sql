-- Whether an account can sign in with a password, without exposing the hash.
-- Tracked as a Hasura computed field on auth.users so the profile page can
-- offer "set a password" or "change password" rather than guessing.
create or replace function public.user_has_password(user_row auth.users)
returns boolean
language sql
stable
as $$
  select user_row.password_hash is not null;
$$;
