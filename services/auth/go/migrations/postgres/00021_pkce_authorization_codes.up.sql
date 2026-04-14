CREATE TABLE auth.pkce_authorization_codes (
    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    code_hash text NOT NULL UNIQUE,
    code_challenge text NOT NULL,
    redirect_to text,
    expires_at timestamp with time zone NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX pkce_authorization_codes_expires_at_idx ON auth.pkce_authorization_codes (expires_at);
