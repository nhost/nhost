# PostgreSQL image

PostGIS 3.7 split the address standardizer and TIGER geocoder into standalone projects, packaged by `extensions/address_standardizer.nix` and `extensions/postgis_tiger_geocoder.nix`. Preserve these bundled extensions and their upgrade paths from the previous PostGIS 3.6 versions when updating their sources.

PostGIS core, raster, and topology must retain `--ANY` tag links for every version shipped with PG17/PG18 in `extensions/postgis.nix`; the bulk upgrade installer is disabled. See [Extension upgrades](README.md#extension-upgrades) for the packaging and regression-test contract.

pg_search upgrades crossing 0.26 must keep extension SQL and vector-index maintenance atomic in `postgres/bin/upgrade-pg-search.sql`; the old extension version is the retry marker. Preserve index identity/metadata and skip maintenance on current-version boots. Partitioned parents cannot use `ALTER INDEX RESET`; keep their narrowly scoped, table-locked option cleanup and physical-child rebuilds covered by `tests/test-pg-search-upgrades.sh`. TIGER needs only the existing startup extension upgrade, not fresh-install or recurring search-path repair.

Keep the image's pg_durable HTTP allow-list explicitly empty by default through `PG_DURABLE_HTTP_ALLOWED_DOMAINS` and the configuration template, overriding upstream's Azure/GitHub defaults. Empty denies all hosts in `restricted` mode; the default policy remains `unrestricted`, which ignores the list. See `tests/test_settings.py` and `tests/pg_durable_http.sql` for the defaults contract.

Keep `docs/src/content/docs/products/database/extensions.mdx` focused on Nhost Cloud and follow the neighboring sections' install/uninstall and resource-link conventions. Public upgrade guidance should cover Nhost-managed maintenance and application changes, not manual extension updates or recovery procedures. Document image environment variables and self-hosted administration in this project's `README.md`, not the public guide.

When adding, updating, or removing extensions, check whether their libraries provide logical-decoding output plugins. Add or remove those plugin library names from `postgres/etc/postgresql.conf.tmpl` (`output_plugin_libraries`) as appropriate, retaining the built-in `pgoutput` and `test_decoding`. This is a security allowlist, not `shared_preload_libraries`; do not list extensions that cannot serve as output plugins.
