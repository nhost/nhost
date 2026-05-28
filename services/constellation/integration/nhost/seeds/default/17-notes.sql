-- Seed one parent note owned by Sarah Martinez (seed user 550e...0001).
-- note_replies is the nested array-relationship child whose insert check
-- walks back through note_id to assert notes.author_id = X-Hasura-User-Id.
INSERT INTO
    public.notes (id, author_id, title)
VALUES
    (
        '0199bbbb-0000-7000-8000-000000000001',
        '550e8400-e29b-41d4-a716-446655440001',
        'Seeded parent note'
    );
