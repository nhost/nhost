-- Insert test users for development and testing
BEGIN;

INSERT INTO auth.users (id, display_name, email, locale, disabled, default_role, created_at, updated_at)
  VALUES
    ('a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d', 'John Doe', 'john@example.com', 'en', false, 'user', '2024-01-15 10:00:00+00', '2024-01-15 10:00:00+00'),
    ('b2c3d4e5-f6a7-4b5c-9d0e-1f2a3b4c5d6e', 'Jane Smith', 'jane@example.com', 'en', false, 'user', '2024-03-20 14:30:00+00', '2024-03-20 14:30:00+00'),
    ('c3d4e5f6-a7b8-4c5d-0e1f-2a3b4c5d6e7f', 'Bob Johnson', 'bob@example.com', 'en', true, 'user', '2024-06-10 09:15:00+00', '2024-06-10 09:15:00+00'),
    ('d4e5f6a7-b8c9-4d5e-1f2a-3b4c5d6e7f8a', 'Alice Williams', 'alice@example.com', 'en', false, 'anonymous', '2024-08-05 16:45:00+00', '2024-08-05 16:45:00+00'),
    ('e5f6a7b8-c9d0-4e5f-2a3b-4c5d6e7f8a9b', 'Charlie Brown', 'charlie@example.com', 'en', false, 'user', '2023-12-01 08:00:00+00', '2023-12-01 08:00:00+00');

COMMIT;
