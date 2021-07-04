ALTER TABLE auth.users
  ADD COLUMN last_confirmation_email_sent_at timestamp with time zone DEFAULT now() NOT NULL;

