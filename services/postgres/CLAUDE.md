# PostgreSQL image

When adding, updating, or removing extensions, check whether their libraries provide logical-decoding output plugins. Add or remove those plugin library names from `postgres/etc/postgresql.conf.tmpl` (`output_plugin_libraries`) as appropriate, retaining the built-in `pgoutput` and `test_decoding`. This is a security allowlist, not `shared_preload_libraries`; do not list extensions that cannot serve as output plugins.
