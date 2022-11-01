# Seed Data Storage

This is an example of how to seed data and storage.

> NOTE: Seeding data and storage only works locally.

## Get Started

Start Nhost:

```
nhost up
```

Install dependencies:

```
pnpm install
```

Seed storage by uploading file(s) directly to the local S3 server.

```
pnpm run seed-storage
```

The database and storage has now been seeded successfully.

You can now try to fetch the seeded image:

[http://localhost:1337/v1/storage/files/3d62252d-8db2-4b2b-ba63-f2ef64af4267](http://localhost:1337/v1/storage/files/3d62252d-8db2-4b2b-ba63-f2ef64af4267)

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

which should return:

```json
{
  "data": {
    "images": [
      {
        "id": "5ced5c51-98a4-4e16-9b8a-de03267d42fc",
        "name": "nhost-nextjs.png",
        "file": {
          "id": "3d62252d-8db2-4b2b-ba63-f2ef64af4267",
          "size": 12131,
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

Once Nhost has started, we run a seed-scripts (`pnpm run seed-storage`) that uploads files directly to S3.

This way, both data in the database, and files in storage are in sync.
