# PostgreSQL image

PostGIS 3.7 split the address standardizer and TIGER geocoder into standalone projects, packaged by `extensions/address_standardizer.nix` and `extensions/postgis_tiger_geocoder.nix`. Preserve these bundled extensions and their upgrade paths from the previous PostGIS 3.6 versions when updating their sources.

PostGIS core, raster, and topology must retain `--ANY` tag links for every version shipped with PG17/PG18 in `extensions/postgis.nix`; the bulk upgrade installer is disabled. See [Extension upgrades](README.md#extension-upgrades) for the packaging and regression-test contract.

When adding, updating, or removing extensions, check whether their libraries provide logical-decoding output plugins. Add or remove those plugin library names from `postgres/etc/postgresql.conf.tmpl` (`output_plugin_libraries`) as appropriate, retaining the built-in `pgoutput` and `test_decoding`. This is a security allowlist, not `shared_preload_libraries`; do not list extensions that cannot serve as output plugins.
