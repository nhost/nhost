-- Do not add a comment on the auth schema as the postgresql user is not necessarily the owner of the schema
-- comment on schema auth is 'Schema required by Hasura Auth to work. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.schema_migrations is 'Internal table for tracking migrations. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.provider_requests is 'Oauth requests, inserted before redirecting to the provider''s site. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.providers is 'List of available Oauth providers. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.roles is 'Persistent Hasura roles for users. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.users is 'User account information. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.refresh_tokens is 'User refresh tokens. Hasura auth uses them to rotate new access tokens as long as the refresh token is not expired. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.user_providers is 'Active providers for a given user. Don''t modify its structure as Hasura Auth relies on it to function properly.';
comment on table auth.user_roles is 'Roles of users. Don''t modify its structure as Hasura Auth relies on it to function properly.';
