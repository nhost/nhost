# Seed Data

This example has a `customers` table and seed data with 4 customers.

The seed data is located here:

- [nhost/seeds/default/001-customer.sql](./nhost/seeds/default/001-customers.sql)

## Get Started

Start Nhost. Seed data is applied automatically on start up:

```
nhost up
```

## Re-Apply Seed Data

Seed data is only applied **the first time** when Nhost starts. If you want to re-apply seed data you need to delete the local database (`rm -rf .nhost`) and start Nhost again (`nhost up`).

## Documentation

Learn more about [Seed data](https://docs.nhost.io/platform/database#seed-data).
