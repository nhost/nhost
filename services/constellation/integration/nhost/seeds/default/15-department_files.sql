-- Insert sample files into storage.files
-- These files will be associated with departments
-- All fields are explicitly specified for consistent test data
INSERT INTO
    storage.files (
        id,
        bucket_id,
        name,
        size,
        mime_type,
        etag,
        is_uploaded,
        uploaded_by_user_id,
        created_at,
        updated_at,
        metadata
    )
VALUES
    -- HR files (default bucket)
    (
        'f1e9b8db-1111-439f-9d63-7f83de523fb1',
        'default',
        'employee-handbook-2025.pdf',
        2048000,
        'application/pdf',
        'etag-handbook-2025',
        true,
        '550e8400-e29b-41d4-a716-446655440001',
        '2025-01-15 10:00:00+00',
        '2025-01-15 10:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-2222-439f-9d63-7f83de523fb2',
        'default',
        'benefits-overview.pdf',
        1024000,
        'application/pdf',
        'etag-benefits-overview',
        true,
        '550e8400-e29b-41d4-a716-446655440002',
        '2025-01-15 10:15:00+00',
        '2025-01-15 10:15:00+00',
        NULL
    ),
    (
        'f1e9b8db-3333-439f-9d63-7f83de523fb3',
        'default',
        'onboarding-checklist.xlsx',
        512000,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'etag-onboarding-checklist',
        true,
        '550e8400-e29b-41d4-a716-446655440003',
        '2025-01-15 10:30:00+00',
        '2025-01-15 10:30:00+00',
        NULL
    ),
    -- Engineering files (default bucket)
    (
        'f1e9b8db-4444-439f-9d63-7f83de523fb4',
        'default',
        'architecture-diagram.png',
        3072000,
        'image/png',
        'etag-architecture-diagram',
        true,
        '550e8400-e29b-41d4-a716-446655440011',
        '2025-01-16 09:00:00+00',
        '2025-01-16 09:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-5555-439f-9d63-7f83de523fb5',
        'default',
        'api-documentation.pdf',
        4096000,
        'application/pdf',
        'etag-api-docs',
        true,
        '550e8400-e29b-41d4-a716-446655440012',
        '2025-01-16 09:30:00+00',
        '2025-01-16 09:30:00+00',
        NULL
    ),
    (
        'f1e9b8db-6666-439f-9d63-7f83de523fb6',
        'default',
        'coding-standards.md',
        128000,
        'text/markdown',
        'etag-coding-standards',
        true,
        '550e8400-e29b-41d4-a716-446655440013',
        '2025-01-16 10:00:00+00',
        '2025-01-16 10:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-7777-439f-9d63-7f83de523fb7',
        'default',
        'deployment-guide.pdf',
        2560000,
        'application/pdf',
        'etag-deployment-guide',
        true,
        '550e8400-e29b-41d4-a716-446655440014',
        '2025-01-16 10:30:00+00',
        '2025-01-16 10:30:00+00',
        NULL
    ),
    -- Marketing files (default bucket)
    (
        'f1e9b8db-8888-439f-9d63-7f83de523fb8',
        'default',
        'brand-guidelines.pdf',
        5120000,
        'application/pdf',
        'etag-brand-guidelines',
        true,
        '550e8400-e29b-41d4-a716-446655440021',
        '2025-01-17 11:00:00+00',
        '2025-01-17 11:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-9999-439f-9d63-7f83de523fb9',
        'default',
        'social-media-calendar-q1.xlsx',
        768000,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'etag-social-media-calendar',
        true,
        '550e8400-e29b-41d4-a716-446655440022',
        '2025-01-17 11:30:00+00',
        '2025-01-17 11:30:00+00',
        NULL
    ),
    (
        'f1e9b8db-aaaa-439f-9d63-7f83de523fba',
        'default',
        'marketing-strategy-2025.pptx',
        8192000,
        'application/vnd.openxmlformats-officedocument.presentationml.presentation',
        'etag-marketing-strategy',
        true,
        '550e8400-e29b-41d4-a716-446655440023',
        '2025-01-17 12:00:00+00',
        '2025-01-17 12:00:00+00',
        NULL
    ),
    -- Sales files (default bucket)
    (
        'f1e9b8db-bbbb-439f-9d63-7f83de523fbb',
        'default',
        'sales-playbook.pdf',
        3584000,
        'application/pdf',
        'etag-sales-playbook',
        true,
        '550e8400-e29b-41d4-a716-446655440031',
        '2025-01-18 08:00:00+00',
        '2025-01-18 08:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-cccc-439f-9d63-7f83de523fbc',
        'default',
        'pricing-guide.xlsx',
        640000,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'etag-pricing-guide',
        true,
        '550e8400-e29b-41d4-a716-446655440032',
        '2025-01-18 08:30:00+00',
        '2025-01-18 08:30:00+00',
        NULL
    ),
    (
        'f1e9b8db-dddd-439f-9d63-7f83de523fbd',
        'default',
        'customer-success-stories.pdf',
        4608000,
        'application/pdf',
        'etag-customer-stories',
        true,
        '550e8400-e29b-41d4-a716-446655440033',
        '2025-01-18 09:00:00+00',
        '2025-01-18 09:00:00+00',
        NULL
    ),
    -- Finance files (default bucket)
    (
        'f1e9b8db-eeee-439f-9d63-7f83de523fbe',
        'default',
        'budget-2025.xlsx',
        1536000,
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'etag-budget-2025',
        true,
        '550e8400-e29b-41d4-a716-446655440041',
        '2025-01-19 14:00:00+00',
        '2025-01-19 14:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-ffff-439f-9d63-7f83de523fbf',
        'default',
        'financial-report-q4.pdf',
        2048000,
        'application/pdf',
        'etag-financial-report-q4',
        true,
        '550e8400-e29b-41d4-a716-446655440042',
        '2025-01-19 14:30:00+00',
        '2025-01-19 14:30:00+00',
        NULL
    ),
    (
        'f1e9b8db-1010-439f-9d63-7f83de523fc0',
        'default',
        'expense-policy.pdf',
        896000,
        'application/pdf',
        'etag-expense-policy',
        true,
        '550e8400-e29b-41d4-a716-446655440043',
        '2025-01-19 15:00:00+00',
        '2025-01-19 15:00:00+00',
        NULL
    ),
    -- Operations files (default bucket)
    (
        'f1e9b8db-2020-439f-9d63-7f83de523fc1',
        'default',
        'operations-manual.pdf',
        6144000,
        'application/pdf',
        'etag-operations-manual',
        true,
        '550e8400-e29b-41d4-a716-446655440051',
        '2025-01-20 13:00:00+00',
        '2025-01-20 13:00:00+00',
        NULL
    ),
    (
        'f1e9b8db-3030-439f-9d63-7f83de523fc2',
        'default',
        'vendor-contracts.zip',
        10240000,
        'application/zip',
        'etag-vendor-contracts',
        true,
        '550e8400-e29b-41d4-a716-446655440052',
        '2025-01-20 13:30:00+00',
        '2025-01-20 13:30:00+00',
        NULL
    ),
    (
        'f1e9b8db-4040-439f-9d63-7f83de523fc3',
        'default',
        'process-flowcharts.pdf',
        4096000,
        'application/pdf',
        'etag-process-flowcharts',
        true,
        '550e8400-e29b-41d4-a716-446655440053',
        '2025-01-20 14:00:00+00',
        '2025-01-20 14:00:00+00',
        NULL
    ),
    -- Profile pictures (profile_pics bucket)
    (
        'f1e9b8db-5050-439f-9d63-7f83de523fc4',
        'profile_pics',
        'hr-team-photo.jpg',
        524288,
        'image/jpeg',
        'etag-hr-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440001',
        '2025-01-21 10:00:00+00',
        '2025-01-21 10:00:00+00',
        '{"width": 1920, "height": 1080}'::jsonb
    ),
    (
        'f1e9b8db-6060-439f-9d63-7f83de523fc5',
        'profile_pics',
        'engineering-team-photo.jpg',
        768432,
        'image/jpeg',
        'etag-eng-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440011',
        '2025-01-21 10:30:00+00',
        '2025-01-21 10:30:00+00',
        '{"width": 2048, "height": 1536}'::jsonb
    ),
    (
        'f1e9b8db-7070-439f-9d63-7f83de523fc6',
        'profile_pics',
        'marketing-team-photo.jpg',
        612345,
        'image/jpeg',
        'etag-marketing-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440021',
        '2025-01-21 11:00:00+00',
        '2025-01-21 11:00:00+00',
        '{"width": 1920, "height": 1280}'::jsonb
    ),
    (
        'f1e9b8db-8080-439f-9d63-7f83de523fc7',
        'profile_pics',
        'sales-team-photo.jpg',
        587654,
        'image/jpeg',
        'etag-sales-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440031',
        '2025-01-21 11:30:00+00',
        '2025-01-21 11:30:00+00',
        '{"width": 1920, "height": 1080}'::jsonb
    ),
    (
        'f1e9b8db-9090-439f-9d63-7f83de523fc8',
        'profile_pics',
        'finance-team-photo.jpg',
        498765,
        'image/jpeg',
        'etag-finance-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440041',
        '2025-01-21 12:00:00+00',
        '2025-01-21 12:00:00+00',
        '{"width": 1600, "height": 1200}'::jsonb
    ),
    (
        'f1e9b8db-a0a0-439f-9d63-7f83de523fc9',
        'profile_pics',
        'operations-team-photo.jpg',
        543210,
        'image/jpeg',
        'etag-ops-team-photo',
        true,
        '550e8400-e29b-41d4-a716-446655440051',
        '2025-01-21 12:30:00+00',
        '2025-01-21 12:30:00+00',
        '{"width": 1920, "height": 1080}'::jsonb
    );

-- Associate files with departments through department_files table
INSERT INTO
    public.department_files (id, file_id, department_id, description)
VALUES
    -- HR files
    (
        'd1e9b8db-1111-439f-9d63-7f83de523fb1',
        'f1e9b8db-1111-439f-9d63-7f83de523fb1',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'Comprehensive employee handbook covering all company policies and procedures'
    ),
    (
        'd1e9b8db-2222-439f-9d63-7f83de523fb2',
        'f1e9b8db-2222-439f-9d63-7f83de523fb2',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'Overview of employee benefits including health insurance, retirement plans, and perks'
    ),
    (
        'd1e9b8db-3333-439f-9d63-7f83de523fb3',
        'f1e9b8db-3333-439f-9d63-7f83de523fb3',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'New hire onboarding checklist and timeline'
    ),
    -- Engineering files
    (
        'd1e9b8db-4444-439f-9d63-7f83de523fb4',
        'f1e9b8db-4444-439f-9d63-7f83de523fb4',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'System architecture diagram showing microservices and infrastructure'
    ),
    (
        'd1e9b8db-5555-439f-9d63-7f83de523fb5',
        'f1e9b8db-5555-439f-9d63-7f83de523fb5',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'Complete API documentation with endpoints, authentication, and examples'
    ),
    (
        'd1e9b8db-6666-439f-9d63-7f83de523fb6',
        'f1e9b8db-6666-439f-9d63-7f83de523fb6',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'Engineering team coding standards and best practices'
    ),
    (
        'd1e9b8db-7777-439f-9d63-7f83de523fb7',
        'f1e9b8db-7777-439f-9d63-7f83de523fb7',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'Step-by-step deployment guide for production environments'
    ),
    -- Marketing files
    (
        'd1e9b8db-8888-439f-9d63-7f83de523fb8',
        'f1e9b8db-8888-439f-9d63-7f83de523fb8',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'Complete brand guidelines including logos, colors, and typography'
    ),
    (
        'd1e9b8db-9999-439f-9d63-7f83de523fb9',
        'f1e9b8db-9999-439f-9d63-7f83de523fb9',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'Q1 social media content calendar with scheduled posts'
    ),
    (
        'd1e9b8db-aaaa-439f-9d63-7f83de523fba',
        'f1e9b8db-aaaa-439f-9d63-7f83de523fba',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        '2025 marketing strategy presentation with goals and initiatives'
    ),
    -- Sales files
    (
        'd1e9b8db-bbbb-439f-9d63-7f83de523fbb',
        'f1e9b8db-bbbb-439f-9d63-7f83de523fbb',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'Sales team playbook with objection handling and closing techniques'
    ),
    (
        'd1e9b8db-cccc-439f-9d63-7f83de523fbc',
        'f1e9b8db-cccc-439f-9d63-7f83de523fbc',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'Product pricing guide for all tiers and add-ons'
    ),
    (
        'd1e9b8db-dddd-439f-9d63-7f83de523fbd',
        'f1e9b8db-dddd-439f-9d63-7f83de523fbd',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'Customer success stories and case studies for sales presentations'
    ),
    -- Finance files
    (
        'd1e9b8db-eeee-439f-9d63-7f83de523fbe',
        'f1e9b8db-eeee-439f-9d63-7f83de523fbe',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'Company-wide budget allocations for 2025'
    ),
    (
        'd1e9b8db-ffff-439f-9d63-7f83de523fbf',
        'f1e9b8db-ffff-439f-9d63-7f83de523fbf',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'Q4 financial report with revenue, expenses, and profit analysis'
    ),
    (
        'd1e9b8db-1010-439f-9d63-7f83de523fc0',
        'f1e9b8db-1010-439f-9d63-7f83de523fc0',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'Corporate expense reimbursement policy and procedures'
    ),
    -- Operations files
    (
        'd1e9b8db-2020-439f-9d63-7f83de523fc1',
        'f1e9b8db-2020-439f-9d63-7f83de523fc1',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'Complete operations manual covering all standard operating procedures'
    ),
    (
        'd1e9b8db-3030-439f-9d63-7f83de523fc2',
        'f1e9b8db-3030-439f-9d63-7f83de523fc2',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'Archive of vendor contracts and service agreements'
    ),
    (
        'd1e9b8db-4040-439f-9d63-7f83de523fc3',
        'f1e9b8db-4040-439f-9d63-7f83de523fc3',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'Process flowcharts for key operational workflows'
    ),
    -- Profile pictures
    (
        'd1e9b8db-5050-439f-9d63-7f83de523fc4',
        'f1e9b8db-5050-439f-9d63-7f83de523fc4',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'Human Resources team photo'
    ),
    (
        'd1e9b8db-6060-439f-9d63-7f83de523fc5',
        'f1e9b8db-6060-439f-9d63-7f83de523fc5',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'Engineering team photo'
    ),
    (
        'd1e9b8db-7070-439f-9d63-7f83de523fc6',
        'f1e9b8db-7070-439f-9d63-7f83de523fc6',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'Marketing team photo'
    ),
    (
        'd1e9b8db-8080-439f-9d63-7f83de523fc7',
        'f1e9b8db-8080-439f-9d63-7f83de523fc7',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'Sales team photo'
    ),
    (
        'd1e9b8db-9090-439f-9d63-7f83de523fc8',
        'f1e9b8db-9090-439f-9d63-7f83de523fc8',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'Finance team photo'
    ),
    (
        'd1e9b8db-a0a0-439f-9d63-7f83de523fc9',
        'f1e9b8db-a0a0-439f-9d63-7f83de523fc9',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'Operations team photo'
    );
