CREATE TABLE public.webhook_events (
    id uuid NOT NULL DEFAULT gen_random_uuid(),
    source text NOT NULL,
    event_type text NOT NULL,
    payload jsonb NOT NULL,
    received_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (id)
);

COMMENT ON TABLE public.webhook_events IS 'Events received from third-party webhooks (see examples/webhook-receiver).';
