-- Seed one parent exercise_log owned by Sarah Martinez (seed user 550e...0001),
-- with kind 'strength' so the composite FK from exercise_log_sets resolves.
INSERT INTO
    public.exercise_logs (id, kind, owner_id)
VALUES
    (
        '0199aaaa-0000-7000-8000-000000000001',
        'strength',
        '550e8400-e29b-41d4-a716-446655440001'
    );
