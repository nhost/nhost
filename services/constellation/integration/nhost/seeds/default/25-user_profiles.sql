-- Insert user profiles for testing remote relationships
INSERT INTO
    public.user_profiles (
        id,
        created_at,
        updated_at,
        user_id,
        address
    )
VALUES
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567801',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440001',
        '123 Oak Street, San Francisco, CA 94102'
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567802',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440002',
        '456 Pine Avenue, Oakland, CA 94612'
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567803',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440003',
        '789 Maple Drive, Berkeley, CA 94704'
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567804',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440004',
        '321 Cedar Lane, Palo Alto, CA 94301'
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567805',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440005',
        '654 Birch Boulevard, Mountain View, CA 94040'
    ),
    (
        'a1b2c3d4-e5f6-7890-abcd-ef1234567806',
        NOW(),
        NOW(),
        '550e8400-e29b-41d4-a716-446655440006',
        '987 Elm Court, Sunnyvale, CA 94086'
    );
