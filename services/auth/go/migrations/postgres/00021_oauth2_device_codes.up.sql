CREATE TABLE auth.oauth2_device_codes (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    device_code_hash text NOT NULL UNIQUE,
    user_code text NOT NULL UNIQUE,
    client_id text NOT NULL REFERENCES auth.oauth2_clients(client_id) ON UPDATE CASCADE ON DELETE CASCADE,
    scopes text[] NOT NULL DEFAULT '{}',
    user_id uuid REFERENCES auth.users(id) ON UPDATE CASCADE ON DELETE CASCADE,
    status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
    last_polled_at timestamptz,
    polling_interval integer NOT NULL DEFAULT 5,
    created_at timestamptz NOT NULL DEFAULT now(),
    expires_at timestamptz NOT NULL,
    CONSTRAINT oauth2_device_codes_scopes_check
        CHECK (scopes <@ ARRAY['openid','profile','email','phone','offline_access','graphql']::text[])
);
CREATE INDEX oauth2_device_codes_expires_at_idx ON auth.oauth2_device_codes (expires_at);
CREATE INDEX oauth2_device_codes_user_id_idx ON auth.oauth2_device_codes (user_id);
