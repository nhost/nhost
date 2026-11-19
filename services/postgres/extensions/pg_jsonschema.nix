{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_jsonschema";
  version = "0.3.4-unstable-2026-09-30";

  doCheck = false;

  cargo-pgrx = pkgs.nhost.cargo-pgrx_0_19_2;

  src = pkgs.fetchFromGitHub {
    owner = "supabase";
    repo = pname;
    # The v0.3.4 tag uses pgrx 0.16.1; this post-tag revision uses 0.19.2
    # and fixes stale compiled-schema caches. Later revisions change the
    # generated SQL under 0.3.4; keep the shipped extension SQL immutable.
    rev = "0eb7dda542db4e995256cd3d194db819b923a6e6";
    hash = "sha256-gJrCmL3aYQyZ6v69nQaB7duQd7okZNfh9GXkN8hX5Eo=";
  };

  cargoHash = "sha256-r6+kcKVDNHLxhL3o71DKABEcVjNzBpIds9Lkk1ON2go=";

  postInstall = ''
    install -m 0444 \
      ${./pg_jsonschema--0.3.3--0.3.4.sql} \
      "$out/share/postgresql/extension/pg_jsonschema--0.3.3--0.3.4.sql"

    ${pkgs.python3}/bin/python3 ${./check-pg-jsonschema-upgrade.py} \
      "$out/share/postgresql/extension/pg_jsonschema--0.3.4.sql" \
      "$out/share/postgresql/extension/pg_jsonschema--0.3.3--0.3.4.sql"
  '';
}
