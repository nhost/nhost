# Storage

Storage is a service that adds a storage service on top of hasura and any s3-compatible storage service. The goal is to be able to leverage the cloud storage service while also leveraging hasura features like its graphql API, permissions, actions, presets, etc...

## Workflows

To understand what Storage does we can look at the two main workflows to upload and retrieve files.

### Uploading files

When a user wants to upload a file Storage will first check with hasura if the user is allowed to do so, if it the file will be uploaded to s3 and, on completion, file metadata will be stored in hasura.

``` mermaid
sequenceDiagram
    actor User
    autonumber
    User->>+Storage: upload file
    Storage->>+hasura: check permissions
    hasura->>-Storage: return if user can upload file
    Storage->>+s3: upload file
    s3->>-Storage: file information
    Storage->>+hasura: file metadata
    hasura->>-Storage: success
    Storage->>-User: file metadata
```

### Retrieving files

Similarly, when retrieving files, Storage will first check with hasura if the user has permissions to retrieve the file and if the user is allowed, it will forward the file to the user:

``` mermaid
sequenceDiagram
    actor User
    autonumber
    User->>+Storage: request file
    Storage->>+hasura: check permissions
    hasura->>-Storage: return if user can access file
    Storage->>+s3: request file
    s3->>-Storage: file
    Storage->>-User: file
```

## Features

The main features of the service are:

- leverage hasura's permissions to allow users to upload/retrieve files
- upload files to any s3-compatible service
- download files from any s3-compatible service
- create presigned URLs to grant temporary access
- caching information to integrate with caches and CDNs (cache headers, etag, conditional headers, etc)
- perform basic image manipulation on the fly
- integration with [clamav](https://www.clamav.net) antivirus

## Antivirus

Integration with [clamav](https://www.clamav.net) antivirus relies on an external [clamd](https://docs.clamav.net/manual/Usage/Scanning.html#clamd) service. When a file is uploaded `Storage` will create the file metadata first and then check if the file is clean with `clamd` via its TCP socket. If the file is clean the rest of the process will continue as usual. If a virus is found details about the virus will be added to the `virus` table and the rest of the process will be aborted.

``` mermaid
sequenceDiagram
    actor User
    User ->> storage: upload file
    storage ->>clamav: check for virus
    alt virus found
        storage-->s3: abort upload
        storage->>graphql: insert row in virus table
    else virus not found
        storage->>s3: upload
        storage->>graphql: update metadata
    end

```

This feature can be enabled with the flag `--clamav-server string`, where `string` is the tcp address for the clamd service.

## Storage usage and total-size limit

Migration `000006_add-usage-counter` installs triggers on `storage.files` and seeds the `storage.usage` counter from uploaded file sizes. The triggers run even when metrics and the limit are disabled; size-neutral changes do not update the counter. Apply this migration before enabling either feature. If the migration times out while waiting for its `storage.files` lock (`lock_timeout = '10s'`), retry it after the blocking transaction has finished.

- `--postgres-source` / `POSTGRES_SOURCE`: persistent Postgres connection for usage reads. If unset, it falls back to `--postgres-migrations-source` / `POSTGRES_MIGRATIONS_SOURCE`. The runtime connection role needs `SELECT` on `storage.usage`.
- `--metrics-bind` / `METRICS_BIND`: enables `GET /metrics` on a separate listener when set; unset disables it. Bind to a private address. A private bind is not access control: do not route this listener through public ingress. The gauge `nhost_storage_total_bytes` reports uploaded bytes without labels. Every replica reports the same database total; aggregate replicas with `max`, never `sum`.
- `--max-total-storage-size` / `MAX_TOTAL_STORAGE_SIZE`: optional byte limit; `0` or unset disables enforcement. At a current total **greater than or equal to** the limit, uploads (including multi-file requests) and replaces are rejected as a whole with HTTP 413, `error.message` `"storage limit exceeded"` (also sent in the `X-Error` header), and `error.data.currentSize` / `error.data.maxSize`. The check does not reserve space for an in-flight request: an upload can cross the limit, and concurrent requests can overshoot it. A replace temporarily removes the old file's size from the counter; a request admitted during that brief dip can also overshoot the limit. If a usage read fails during a limit check, the service logs a warning and allows the request.

When either feature is enabled, startup probes the counter and refuses to start if the Postgres source is unavailable or the counter row is missing or unreadable (including when Postgres migrations are disabled). A negative limit also prevents startup. A failed metrics scrape returns HTTP 500 rather than a stale value.

## Documentation

- [Official Documentation](https://docs.nhost.io/products/storage/overview).
- [OpenAPI schema](https://docs.nhost.io/reference/storage/post-files)
