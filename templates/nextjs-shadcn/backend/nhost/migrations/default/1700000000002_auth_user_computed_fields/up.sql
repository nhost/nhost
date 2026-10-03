-- The computed fields this template puts on `auth.users`.
--
-- They share a migration because they share a reason: `auth.users` is owned by
-- the auth service, so a column cannot be added to it here, and anything the
-- app needs to derive from a row it is not allowed to expose has to arrive as
-- a function tracked by Hasura. Both below answer a question about an account
-- without handing out the column the answer is computed from.

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

-- The display name, but only once its owner has chosen one.
--
-- Nhost auth defaults `display_name` to the address the account signed up
-- with, so for anyone who never set a name the raw column *is* their email.
-- That cannot be shown to strangers: the `public` role's filter has no per-id
-- cap, so a single unauthenticated query would walk the whole table and come
-- back with the project's address book. This returns NULL for every value the
-- owner did not type themselves, so "never chose a name" is indistinguishable
-- from "has no name" and the page simply has nothing to print. The `public`
-- role is granted this instead of `display_name`; see
-- `backend/nhost/metadata/databases/default/tables/auth_users.yaml`.
--
-- The test is "does this look like an address" rather than "does this equal
-- the address", and the difference is the whole reason this function is more
-- than one `nullif`. Changing an email does not rewrite the display name:
-- auth's `UpdateUserConfirmChangeEmail` sets `(email, new_email) =
-- (new_email, null)` and leaves `display_name` alone, and this template ships
-- that flow on its own profile page. An account that signed up as
-- `alice@old.example.com` and later moved to `alice@new.example.com` is left
-- holding the *previous* address in `display_name` - which no comparison
-- against the current one can see, because the two genuinely differ. Matching
-- the shape catches it; matching the value does not.
--
-- The remaining branches close the narrower gaps around it. `email` is a
-- domain over `citext` while `display_name` is plain `text`, so Postgres
-- resolves a bare comparison of the two as case-*sensitive* `text = text` and
-- `Alice@Example.com` would slip past a value test; `lower()` on both sides
-- settles it. A whitespace-only name has nothing to show. And an SMS signup
-- defaults the name to the phone number with `email` left NULL, so there is a
-- second identifier to withhold and no email to compare against - hence the
-- explicit `phone_number` branch, and hence being careful that a NULL `email`
-- cannot make the whole expression NULL: a CASE branch that evaluates to NULL
-- is simply not taken, so a chosen name still reaches the `else`.
--
-- A handle like `@paul` survives on purpose: the pattern wants an ordinary
-- character on *both* sides of the `@`, which an address has and a handle
-- does not. The name is returned verbatim, never folded - `lower()` is for
-- comparing, and `nullif` would have returned its lowercased first argument.
create or replace function public.user_public_display_name(user_row auth.users)
returns text
language sql
stable
as $$
  select case
    when nullif(btrim(user_row.display_name), '') is null then null
    when user_row.display_name ~ '[^[:space:]@]@[^[:space:]@]' then null
    when lower(btrim(user_row.display_name)) = lower(user_row.email::text) then null
    when btrim(user_row.display_name) = user_row.phone_number then null
    else user_row.display_name
  end;
$$;
