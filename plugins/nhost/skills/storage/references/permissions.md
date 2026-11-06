# Storage permissions on `storage.files`

Read this before writing or changing any Nhost Storage permission. Storage permissions are ordinary GraphQL-engine permissions on the `storage.files` table. Docs: https://docs.nhost.io/products/storage/permissions

## Mapping

| Storage action | Permission | Must include |
|---|---|---|
| Upload | `insert` | columns `id`, `bucket_id`, `name`, `size`, `mime_type`; preset `uploaded_by_user_id: X-Hasura-User-Id` |
| Download (and presigned URL) | `select` | all columns: `id`, `created_at`, `updated_at`, `bucket_id`, `name`, `size`, `mime_type`, `etag`, `is_uploaded`, `uploaded_by_user_id`, `metadata` |
| Replace | `update` | columns `bucket_id`, `etag`, `is_uploaded`, `metadata`, `mime_type`, `name`, `size` |
| Delete | `delete` | a filter |

Rules use column names (`bucket_id`, `uploaded_by_user_id`), not the GraphQL names (`bucketId`). Session variables: `X-Hasura-User-Id`, `X-Hasura-Role`, and custom claims such as `X-Hasura-Org-Id`.

## Pattern 1: private files per user (default choice)

This is the `user` role in the official tutorial backend (`examples/tutorials/backend/nhost/metadata/databases/default/tables/storage_files.yaml` in the nhost/nhost repo). Add these keys to the existing `storage_files.yaml`; keep its `table`, `configuration` and relationship keys as they are.

```yaml
insert_permissions:
  - role: user
    permission:
      check:
        bucket_id:
          _eq: personal
      set:
        uploaded_by_user_id: X-Hasura-User-Id
      columns:
        - id
        - bucket_id
        - name
        - size
        - mime_type
select_permissions:
  - role: user
    permission:
      columns:
        - id
        - created_at
        - updated_at
        - bucket_id
        - name
        - size
        - mime_type
        - etag
        - is_uploaded
        - uploaded_by_user_id
        - metadata
      filter:
        _and:
          - bucket_id:
              _eq: personal
          - uploaded_by_user_id:
              _eq: X-Hasura-User-Id
delete_permissions:
  - role: user
    permission:
      filter:
        uploaded_by_user_id:
          _eq: X-Hasura-User-Id
```

The docs' version also adds `bucket_id` equals `personal` to the delete filter; add it when the role has files in other buckets it must not delete.

## Pattern 2: public read, authenticated upload

Only after the user confirms the bucket is meant to be public. Upload for `user`: check `bucket_id` equals `public` plus the uploader preset (as above). Download: a `select` for BOTH `public` and `user` with filter `{"bucket_id": {"_eq": "public"}}` and all columns. Never give `public` insert, update or delete.

## Pattern 3: files shared through app data

When access depends on membership (teams, communities, organizations): add a junction table with `file_id uuid NOT NULL REFERENCES storage.files(id) ON DELETE CASCADE`, track an array relationship from `storage.files` to it, then reference the relationship in the `select` filter. Example from the docs (download = own files in `default`/`personal`, OR files of a community the user belongs to):

```json
{
  "_or": [
    {"_and": [
      {"uploaded_by_user_id": {"_eq": "X-Hasura-User-Id"}},
      {"bucket_id": {"_in": ["default", "personal"]}}
    ]},
    {"community_files": {"community": {"members": {"user_id": {"_eq": "X-Hasura-User-Id"}}}}}
  ]
}
```

Full schema, relationships and junction-table permissions: https://docs.nhost.io/products/storage/guides/permissions-and-relationships. The complete demo metadata is `examples/demos/backend/nhost/metadata/databases/default/tables/storage_files.yaml` in nhost/nhost.

## Applying: path A, with the Nhost MCP server

Requires `manage_metadata = true` and an admin secret in the MCP config. Use it against the local project (`subdomain: "local"`), never a production project.

1. Read the current state first: `manage-graphql` with `path: "/v1/metadata"`, `subdomain: "local"`, body `{"type":"export_metadata","args":{}}`. Find the `storage.files` entry.
2. Read the MCP resource `schema://graphql-management` for exact argument shapes. Permission operations: `pg_create_insert_permission`, `pg_create_select_permission`, `pg_create_update_permission`, `pg_create_delete_permission`, and matching `pg_drop_*_permission`.
3. Send the change as a metadata migration: `manage-graphql` with `path: "/apis/migrate"`. On the local project, only `/apis/migrate` writes changes into `nhost/metadata` (and `nhost/migrations`); changes sent to `/v1/metadata` are not saved to the project files and will not deploy. Use `/v1/metadata` for reading only. The request format is the same as in the `database` skill (`references/migrations-with-mcp.md`). Example for the upload permission in pattern 1:

```json
{
  "name": "storage_files_user_upload_personal",
  "datasource": "default",
  "up": [
    {"type": "pg_create_insert_permission", "args": {
      "source": "default",
      "table": {"schema": "storage", "name": "files"},
      "role": "user",
      "permission": {
        "check": {"bucket_id": {"_eq": "personal"}},
        "set": {"uploaded_by_user_id": "X-Hasura-User-Id"},
        "columns": ["id", "bucket_id", "name", "size", "mime_type"]
      }
    }}
  ],
  "down": [
    {"type": "pg_drop_insert_permission", "args": {
      "source": "default", "table": {"schema": "storage", "name": "files"}, "role": "user"}}
  ]
}
```

4. Afterwards run `git status` and confirm `nhost/metadata/databases/default/tables/storage_files.yaml` changed. If it did not, tell the user the change is not in version control and will not deploy.

## Applying: path B, without MCP

1. Edit `nhost/metadata/databases/default/tables/storage_files.yaml` (it is already included from `tables.yaml`). Merge with any existing `*_permissions` entries; one entry per role per action.
2. Run `nhost up` (it applies metadata on start). Fix any metadata error it prints before continuing.
3. Commit the YAML (and any bucket migration). Deploying to Nhost Cloud happens through the linked Git repository.

## Test

Sign in as two different users and check: each can upload to the allowed bucket, cannot upload elsewhere (403), sees only permitted files via `getFile` and the GraphQL `files` query, and cannot delete the other's files.
