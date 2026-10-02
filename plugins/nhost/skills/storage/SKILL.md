---
name: storage
description: Covers Nhost Storage - file upload, download, replace and delete with @nhost/nhost-js v4 (nhost.storage.uploadFiles, getFile, getFilePresignedURL, deleteFile), storage buckets (default bucket, creating buckets, size limits, cache control, presigned URL expiration), file permissions on storage.files (upload/download/delete per role, uploaded_by_user_id owner pattern, bucket_id checks, public files), image transformation (resize, WebP/AVIF, quality, blur), presigned URLs, displaying private images, and linking files to app tables with GraphQL relationships. Use when a user of an Nhost project wants to add file uploads, avatars, attachments, image thumbnails, a new bucket, or file access rules, or debugs a 403 from Nhost Storage. Not for generic table permissions, sign-in, or framework setup.
---

# Nhost Storage

Files live in S3; their metadata lives in the `storage.files` table, exposed through the GraphQL API. Every Storage request is authorized by the GraphQL engine against permissions on `storage.files`, using the caller's JWT session (`X-Hasura-User-Id`, `X-Hasura-Role`, custom claims). Docs: https://docs.nhost.io/products/storage

Look things up before answering: MCP `search` / `read_page`, or `nhost docs search "<q>"` / `nhost docs show <path>`, or https://docs.nhost.io/llms.txt.

## Rules

- SDK is `@nhost/nhost-js` v4. Methods return `{ body, status, headers }` and throw `FetchError` on status >= 300. Do NOT use `storage.upload`, `{ data, error }` destructuring, `new NhostClient`, or `@nhost/react` / `@nhost/nextjs` / `@nhost/vue`.
- Zero trust: no role can upload, download or delete anything until you grant it. A 403 usually means a missing or too narrow permission, not a bug in the upload code.
- Never grant the `public` role anything on `storage.files` except `select` on a bucket that is meant to be public. Ask the user before making any bucket public.
- Always set `uploaded_by_user_id` from `X-Hasura-User-Id` via a preset on upload. Never trust a client-sent owner.
- Delete files only through the Storage API (`deleteFile`). Deleting rows in `storage.files` via GraphQL leaves the file in S3.
- Do not change the schema or GraphQL root fields of `storage` tables. Only add permissions and relationships.
- No admin secret in frontend code. Admin-only storage endpoints (orphaned files, broken metadata) are for server-side use.

## Buckets

- Every project has a `default` bucket; uploads without `bucket-id` go there. It cannot be deleted.
- Per-bucket settings: `min_upload_file_size`, `max_upload_file_size` (bytes), `cache_control`, `presigned_urls_enabled`, `download_expiration` (seconds, 1-604800, default 30).
- Create a bucket with a migration (or the dashboard). Put it in a new migration under `nhost/migrations/default/<timestamp>_<name>/up.sql`:

```sql
INSERT INTO storage.buckets (id, max_upload_file_size, cache_control, presigned_urls_enabled, download_expiration)
VALUES ('avatars', 5242880, 'public, max-age=3600', true, 300);
```

Only set values the user asked for; omitted columns take the defaults. See https://docs.nhost.io/products/storage/buckets

## Permissions

Dashboard action -> permission on `storage.files`:

| Action | Permission | Columns |
|---|---|---|
| Upload | `insert` | `id`, `bucket_id`, `name`, `size`, `mime_type`; preset `uploaded_by_user_id: X-Hasura-User-Id` |
| Download | `select` | all columns |
| Replace | `update` | `bucket_id`, `etag`, `is_uploaded`, `metadata`, `mime_type`, `name`, `size` |
| Delete | `delete` | - |

Default pattern for private user files: upload check `bucket_id` equals the bucket; download and delete check `uploaded_by_user_id` equals `X-Hasura-User-Id` AND `bucket_id` equals the bucket. Grant only the actions the feature needs (no Replace unless asked).

Apply permissions through either path; exact YAML, MCP payloads, and the public-bucket and shared-files patterns are in [references/permissions.md](references/permissions.md). Read it before writing any storage permission.

1. With MCP: `manage-graphql` on path `/apis/migrate`, as a metadata migration with up and down steps (needs `admin_secret` and `manage_metadata`; local project only). Use `/v1/metadata` only for reading: changes sent there are not saved to the project files.
2. Without MCP: edit `nhost/metadata/databases/default/tables/storage_files.yaml`, then run `nhost up`.

## Upload

```typescript
const response = await nhost.storage.uploadFiles({
  'bucket-id': 'personal',           // optional, defaults to "default"
  'file[]': [file],                  // Blob/File array, required
  'metadata[]': [{ name: 'report.pdf', metadata: { department: 'finance' } }], // optional
})
const uploaded = response.body.processedFiles?.[0] // FileMetadata: id, name, size, bucketId, mimeType, ...
```

`metadata[]` entries (`{ id?, name?, metadata? }`) match `file[]` by position; for several files give metadata for all or none. Store `uploaded.id` if the file belongs to an app record (see Linking below).

## Download, presigned URLs, replace, delete

```typescript
const { body } = await nhost.storage.getFile(fileId)            // Blob
const url = URL.createObjectURL(body)                            // revoke with URL.revokeObjectURL when done
const thumb = await nhost.storage.getFile(fileId, { w: 100, h: 100, f: 'webp' })
const { body: signed } = await nhost.storage.getFilePresignedURL(fileId) // signed.url, signed.expiration (s)
await nhost.storage.replaceFile(fileId, { file: newFile })
await nhost.storage.deleteFile(fileId)
```

- A plain `<img src>` to a private file fails (no auth header). Prefer `getFile` + blob URL for private files; use presigned URLs only for recipients that cannot send a token (email links, third parties). They expire per the bucket's `download_expiration` and bypass CDN caching. Public-bucket files can be linked directly.
- Image params: `w`, `h` (1-8000, keep aspect ratio), `q` (1-100), `f` (`auto`, `same`, `jpeg`, `webp`, `png`, `avif`), `b` blur (0-250). Out-of-range values return 400. Each distinct combination is cached separately, so reuse a few sizes. https://docs.nhost.io/products/storage/image-transformation
- List or filter files with the GraphQL API (`files`, `file`, fields `bucketId`, `uploadedByUserId`, `mimeType`, ...), not the Storage API. Permissions apply automatically.
- REST base URL for curl or non-JS clients, local: `https://local.storage.local.nhost.run/v1/files`, with `Authorization: Bearer <JWT>`.

## Linking files to app tables

Keep a `file_id uuid REFERENCES storage.files(id) ON DELETE CASCADE` column in your own table (or a junction table), track the relationship to `storage.files`, and base download permissions on that relationship when access depends on group membership. Flow: upload, then insert the row with the returned `id` via GraphQL. Table permissions on the junction table belong to the `database` skill. Full walkthrough: https://docs.nhost.io/products/storage/guides/permissions-and-relationships

## Stop and ask the user

- Before making any bucket or file readable by `public`.
- Before granting `delete` or `update` without an ownership check.
- When size limits, allowed buckets, or who may see shared files are not stated.

The user's instructions take precedence over this skill.
