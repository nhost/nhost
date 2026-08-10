-- Insert users for Human Resources Department
-- Adding metadata with various structures for testing JSONB operations:
-- _append, _prepend, _delete_at_path, _delete_key, _delete_elem
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'sarah.martinez@company.com',
        'Sarah Martinez',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        -- Rich metadata for testing various JSONB operations
        '{"profile": {"title": "HR Manager", "level": 5, "certifications": ["PHR", "SHRM-CP"]}, "preferences": {"theme": "dark", "notifications": {"email": true, "sms": false}}, "tags": ["manager", "hr", "leadership"], "skills": ["recruitment", "compliance", "training"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        'david.chen@company.com',
        'David Chen',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "HR Specialist", "level": 3}, "preferences": {"theme": "light"}, "tags": ["specialist", "hr"], "recentProjects": [{"id": 1, "name": "Onboarding"}, {"id": 2, "name": "Benefits Review"}]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        'lisa.thompson@company.com',
        'Lisa Thompson',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        -- Array metadata for testing _delete_elem (deletes element at index)
        '["coordinator", "hr", "newcomer", "team-player", "helpful"]'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440004',
        'michael.rodriguez@company.com',
        'Michael Rodriguez',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        -- Array metadata for testing _delete_elem (deletes element at index)
        '["assistant", "eager-learner", "great-communication", "hr", "onboarding"]'::jsonb
    );

-- Insert users for Engineering Department
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440011',
        'alex.kim@company.com',
        'Alex Kim',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Engineering Manager", "level": 6, "yearsExperience": 12}, "preferences": {"theme": "dark", "editor": "vscode", "notifications": {"slack": true, "email": false}}, "languages": ["go", "python", "typescript"], "projects": [{"id": 101, "name": "Platform"}, {"id": 102, "name": "API Gateway"}]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440012',
        'emma.wilson@company.com',
        'Emma Wilson',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Senior Engineer", "level": 5, "specialization": "backend"}, "settings": {"terminal": "iterm2", "shell": "zsh"}, "skills": ["rust", "go", "kubernetes"], "certifications": ["AWS Solutions Architect", "CKA"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440013',
        'james.brown@company.com',
        'James Brown',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Software Engineer", "level": 3}, "preferences": {"theme": "light", "fontSize": 14}, "tags": ["frontend", "react", "typescript"], "achievements": ["hackathon-winner", "bug-hunter"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440014',
        'priya.patel@company.com',
        'Priya Patel',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Junior Engineer", "level": 1, "mentor": "alex.kim"}, "learning": {"currentCourse": "Advanced Go", "completedCourses": ["Intro to Go", "Git Basics"]}, "interests": ["ml", "data-engineering"]}'::jsonb
    );

-- Insert users for Marketing Department
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440021',
        'jessica.garcia@company.com',
        'Jessica Garcia',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Marketing Director", "level": 6}, "campaigns": [{"id": "c1", "name": "Summer Launch"}, {"id": "c2", "name": "Holiday Promo"}], "channels": ["social", "email", "seo"], "metrics": {"followers": 15000, "engagement": 4.5}}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440022',
        'ryan.lee@company.com',
        'Ryan Lee',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Content Manager", "level": 4}, "preferences": {"tools": ["figma", "canva"]}, "content": {"blog": true, "video": true, "podcast": false}, "tags": ["content", "storytelling"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440023',
        'sofia.andersson@company.com',
        'Sofia Andersson',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "SEO Specialist", "level": 3}, "tools": ["ahrefs", "semrush", "google-analytics"], "keywords": ["saas", "devtools", "cloud"], "reports": [{"month": "Jan", "traffic": 50000}, {"month": "Feb", "traffic": 55000}]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440024',
        'carlos.santos@company.com',
        'Carlos Santos',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Social Media Manager", "level": 2}, "platforms": ["twitter", "linkedin", "instagram"], "schedule": {"posting": "daily", "analytics": "weekly"}, "hashtags": ["tech", "startup", "innovation"]}'::jsonb
    );

-- Insert users for Sales Department
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440031',
        'amanda.johnson@company.com',
        'Amanda Johnson',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Sales Director", "level": 6, "region": "North America"}, "quota": {"target": 500000, "achieved": 450000}, "clients": ["acme-corp", "globex", "initech"], "deals": [{"id": "d1", "value": 50000}, {"id": "d2", "value": 75000}]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440032',
        'kevin.wong@company.com',
        'Kevin Wong',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Account Executive", "level": 4}, "territory": {"region": "West", "states": ["CA", "WA", "OR"]}, "pipeline": [{"stage": "qualified", "count": 5}, {"stage": "proposal", "count": 3}], "tags": ["enterprise", "saas"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440033',
        'natalie.davis@company.com',
        'Natalie Davis',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Sales Representative", "level": 2}, "preferences": {"crm": "salesforce", "calendar": "google"}, "leads": ["lead-001", "lead-002", "lead-003"], "activities": {"calls": 25, "emails": 50, "meetings": 10}}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440034',
        'robert.taylor@company.com',
        'Robert Taylor',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "SDR", "level": 1}, "training": {"completed": ["cold-calling", "objection-handling"], "inProgress": "demo-skills"}, "metrics": {"callsPerDay": 50, "meetingsBooked": 8}, "goals": ["hit-quota", "get-promoted"]}'::jsonb
    );

-- Insert users for Finance Department
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440041',
        'rachel.moore@company.com',
        'Rachel Moore',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "CFO", "level": 7, "certifications": ["CPA", "CFA"]}, "reports": {"quarterly": true, "monthly": true}, "budgets": [{"dept": "engineering", "amount": 500000}, {"dept": "marketing", "amount": 200000}], "systems": ["sap", "quickbooks", "excel"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440042',
        'daniel.clark@company.com',
        'Daniel Clark',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Financial Analyst", "level": 4}, "focus": {"area": "forecasting", "models": ["dcf", "monte-carlo"]}, "tools": ["tableau", "power-bi"], "watchlist": ["revenue", "churn", "cac"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440043',
        'michelle.white@company.com',
        'Michelle White',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Accountant", "level": 3}, "responsibilities": ["payroll", "ap", "ar"], "software": {"primary": "quickbooks", "backup": "xero"}, "compliance": ["gaap", "sox"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440044',
        'thomas.hall@company.com',
        'Thomas Hall',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Finance Associate", "level": 1}, "learning": {"path": "financial-modeling", "courses": ["excel-basics", "financial-statements"]}, "tasks": ["data-entry", "reconciliation"], "mentors": ["rachel.moore", "daniel.clark"]}'::jsonb
    );

-- Insert users for Operations Department
INSERT INTO
    auth.users (
        id,
        email,
        display_name,
        avatar_url,
        locale,
        default_role,
        is_anonymous,
        disabled,
        email_verified,
        phone_number_verified,
        created_at,
        updated_at,
        otp_hash_expires_at,
        ticket_expires_at,
        metadata
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440051',
        'jennifer.adams@company.com',
        'Jennifer Adams',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "COO", "level": 7}, "departments": ["engineering", "operations", "support"], "kpis": [{"name": "uptime", "target": 99.9}, {"name": "response-time", "target": 24}], "initiatives": ["automation", "cost-reduction", "quality"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440052',
        'matthew.turner@company.com',
        'Matthew Turner',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "DevOps Lead", "level": 5}, "infrastructure": {"cloud": "aws", "regions": ["us-east-1", "eu-west-1"]}, "tools": ["terraform", "kubernetes", "docker"], "oncall": {"schedule": "weekly", "escalation": ["jennifer.adams"]}}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440053',
        'stephanie.cooper@company.com',
        'Stephanie Cooper',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Process Manager", "level": 3}, "processes": ["onboarding", "offboarding", "procurement"], "documentation": {"status": "in-progress", "coverage": 75}, "stakeholders": ["hr", "finance", "it"]}'::jsonb
    ),
    (
        '550e8400-e29b-41d4-a716-446655440054',
        'christopher.bell@company.com',
        'Christopher Bell',
        '',
        'en',
        'user',
        false,
        false,
        true,
        false,
        NOW (),
        NOW (),
        NOW () + INTERVAL '1 hour',
        NOW () + INTERVAL '1 hour',
        '{"profile": {"title": "Operations Analyst", "level": 2}, "dashboards": ["metrics", "alerts", "costs"], "reports": [{"type": "weekly", "recipients": ["jennifer.adams"]}, {"type": "monthly", "recipients": ["all-managers"]}], "focus": ["efficiency", "automation"]}'::jsonb
    );

-- PRIMARY DEPARTMENT ASSIGNMENTS
-- Assign users to Human Resources Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440001',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'manager',
        NOW () - INTERVAL '2 years',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440002',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '1 year 6 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440003',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '1 year',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440004',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '8 months',
        true
    );

-- Assign users to Engineering Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440011',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'manager',
        NOW () - INTERVAL '3 years',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440012',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '2 years 3 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440013',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '1 year 8 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440014',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '10 months',
        true
    );

-- Assign users to Marketing Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440021',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'manager',
        NOW () - INTERVAL '2 years 6 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440022',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '1 year 4 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440023',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '11 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440024',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '7 months',
        true
    );

-- Assign users to Sales Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440031',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'manager',
        NOW () - INTERVAL '4 years',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440032',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '2 years 1 month',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440033',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '1 year 3 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440034',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '9 months',
        true
    );

-- Assign users to Finance Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440041',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'manager',
        NOW () - INTERVAL '3 years 6 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440042',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '2 years 2 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440043',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '1 year 5 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440044',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '6 months',
        true
    );

-- Assign users to Operations Department (Primary)
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    (
        '550e8400-e29b-41d4-a716-446655440051',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'manager',
        NOW () - INTERVAL '2 years 8 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440052',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '1 year 7 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440053',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '1 year 2 months',
        true
    ),
    (
        '550e8400-e29b-41d4-a716-446655440054',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '5 months',
        true
    );

-- SECONDARY DEPARTMENT ASSIGNMENTS (Cross-departmental collaboration)
-- HR Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Sarah Martinez (HR Manager) also works with Operations for HR policies
    (
        '550e8400-e29b-41d4-a716-446655440001',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '1 year 6 months',
        true
    ),
    -- David Chen (HR) supports Engineering for recruitment and team building
    (
        '550e8400-e29b-41d4-a716-446655440002',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '1 year',
        true
    ),
    -- Lisa Thompson (HR) collaborates with Finance for compensation and benefits
    (
        '550e8400-e29b-41d4-a716-446655440003',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '8 months',
        true
    ),
    -- Michael Rodriguez (HR) works with Marketing for employer branding
    (
        '550e8400-e29b-41d4-a716-446655440004',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '6 months',
        true
    );

-- Engineering Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Alex Kim (Engineering Manager) also supports Operations for technical infrastructure
    (
        '550e8400-e29b-41d4-a716-446655440011',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '2 years',
        true
    ),
    -- Emma Wilson (Engineering) works with Marketing for technical content and demos
    (
        '550e8400-e29b-41d4-a716-446655440012',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '1 year 6 months',
        true
    ),
    -- James Brown (Engineering) collaborates with Sales for technical pre-sales support
    (
        '550e8400-e29b-41d4-a716-446655440013',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '1 year',
        true
    ),
    -- Priya Patel (Engineering) supports Finance for technical budgeting and cost analysis
    (
        '550e8400-e29b-41d4-a716-446655440014',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '8 months',
        true
    );

-- Marketing Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Jessica Garcia (Marketing Manager) collaborates with Sales for lead generation strategies
    (
        '550e8400-e29b-41d4-a716-446655440021',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '2 years',
        true
    ),
    -- Ryan Lee (Marketing) works with HR for internal communications and culture
    (
        '550e8400-e29b-41d4-a716-446655440022',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '1 year',
        true
    ),
    -- Sofia Andersson (Marketing) supports Finance for marketing ROI and budget planning
    (
        '550e8400-e29b-41d4-a716-446655440023',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '9 months',
        true
    ),
    -- Carlos Santos (Marketing) collaborates with Operations for process documentation and training materials
    (
        '550e8400-e29b-41d4-a716-446655440024',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '5 months',
        true
    );

-- Sales Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Amanda Johnson (Sales Manager) works with Finance for revenue forecasting and pricing
    (
        '550e8400-e29b-41d4-a716-446655440031',
        '24e9b8db-acf8-439f-9d63-7f83de523fb3',
        'member',
        NOW () - INTERVAL '3 years',
        true
    ),
    -- Kevin Wong (Sales) collaborates with Engineering for product development feedback
    (
        '550e8400-e29b-41d4-a716-446655440032',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '1 year 6 months',
        true
    ),
    -- Natalie Davis (Sales) supports HR for customer success team hiring
    (
        '550e8400-e29b-41d4-a716-446655440033',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '1 year',
        true
    ),
    -- Robert Taylor (Sales) works with Operations for sales process optimization
    (
        '550e8400-e29b-41d4-a716-446655440034',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '7 months',
        true
    );

-- Finance Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Rachel Moore (Finance Manager) supports Operations for budget management and cost control
    (
        '550e8400-e29b-41d4-a716-446655440041',
        'fd1e6bba-c292-4b2f-872e-ae16146cdd82',
        'member',
        NOW () - INTERVAL '3 years',
        true
    ),
    -- Daniel Clark (Finance) works with Engineering for technology investment planning
    (
        '550e8400-e29b-41d4-a716-446655440042',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '1 year 8 months',
        true
    ),
    -- Michelle White (Finance) collaborates with HR for payroll and benefits administration
    (
        '550e8400-e29b-41d4-a716-446655440043',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '1 year 2 months',
        true
    ),
    -- Thomas Hall (Finance) supports Marketing for campaign budget management
    (
        '550e8400-e29b-41d4-a716-446655440044',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '4 months',
        true
    );

-- Operations Team - Secondary assignments for collaboration
INSERT INTO
    public.user_departments (
        user_id,
        department_id,
        role,
        joined_at,
        is_active
    )
VALUES
    -- Jennifer Adams (Operations Manager) works with Sales for sales operations and CRM management
    (
        '550e8400-e29b-41d4-a716-446655440051',
        'ffd095c2-9745-43d9-b133-7e8d847e8371',
        'member',
        NOW () - INTERVAL '2 years 2 months',
        true
    ),
    -- Matthew Turner (Operations) supports Engineering for DevOps and deployment processes
    (
        '550e8400-e29b-41d4-a716-446655440052',
        '023d4410-715e-4675-96a5-a58fd50ef33c',
        'member',
        NOW () - INTERVAL '1 year 3 months',
        true
    ),
    -- Stephanie Cooper (Operations) collaborates with Marketing for marketing automation and analytics
    (
        '550e8400-e29b-41d4-a716-446655440053',
        'dcd52518-58d0-4834-9683-ba6dee33833f',
        'member',
        NOW () - INTERVAL '10 months',
        true
    ),
    -- Christopher Bell (Operations) works with HR for onboarding processes and employee systems
    (
        '550e8400-e29b-41d4-a716-446655440054',
        '2db9de0a-b9ba-416e-8619-783a399ae2b3',
        'member',
        NOW () - INTERVAL '3 months',
        true
    );