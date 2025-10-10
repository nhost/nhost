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

## Documentation

- [Official Documentation](https://docs.nhost.io/products/storage/overview).
- [OpenAPI schema](https://docs.nhost.io/reference/storage/post-files)
