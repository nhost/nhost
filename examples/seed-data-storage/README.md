# Seed Data Storage

This is an example of how to seed data and storage.

> NOTE: Seeding data and storage only works locally.

## Get Started

Start Nhost:

```
nhost up
```

Seed storage by uploading file(s) directly to the local S3 server.

```
pnpm run seed-storage
```

The database and storage have now been seeded successfully.

You can now try to fetch the seeded files:

- [https://local.storage.nhost.run/v1/files/3d62252d-8db2-4b2b-ba63-f2ef64af4267](https://local.storage.nhost.run/v1/files/3d62252d-8db2-4b2b-ba63-f2ef64af4267)
- [https://local.storage.nhost.run/v1/files/039f89ef-f151-418f-b2db-83c94fbf0fa5](https://local.storage.nhost.run/v1/files/039f89ef-f151-418f-b2db-83c94fbf0fa5)

And make a GraphQL request:

```graphql
query {
  images {
    id
    name
    file {
      id
      size
      mimeType
    }
  }
}
```

which returns:

```json
{
  "data": {
    "images": [
      {
        "id": "5ced5c51-98a4-4e16-9b8a-de03267d42fc",
        "name": "nhost-nextjs.png",
        "file": {
          "id": "3d62252d-8db2-4b2b-ba63-f2ef64af4267",
          "size": 11806,
          "mimeType": "image/png"
        }
      },
      {
        "id": "05b62110-dfa7-42f6-a298-30a60c8a0324",
        "name": "nhost-apple-sign-in.png",
        "file": {
          "id": "039f89ef-f151-418f-b2db-83c94fbf0fa5",
          "size": 463155,
          "mimeType": "image/png"
        }
      }
    ]
  }
}
```

## How Does It Work?

When Nhost starts (`nhost up`) it automatically applies seed data to the `storage.files` and `public.images` tables using SQL:

- [nhost/seed/default/001-images.sql](./nhost/seeds/default/001-images.sql).

This will add all metadata to your database and prepare `storage.files` table by adding the id's for the files to seed.

When `pnpm run see-storage` is run a script is uploading the files with the same file id as was in the initial sql seed file.

This way, both data in the database, and files in storage are in sync.

### Notable files:

- [./nhost/seeds/default/001-images.sql](nhost/seeds/default/001-images.sql)
- [./input.json](input.json)
