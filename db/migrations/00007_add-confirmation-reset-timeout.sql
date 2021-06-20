ALTER TABLE auth.accounts
  ADD COLUMN last_confirmation_email_sent_at timestamp with time zone DEFAULT now() NOT NULL;
  