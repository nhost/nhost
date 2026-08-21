{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_jsonschema";
  version = "0.3.4-unstable-2026-08-03";

  doCheck = false;

  cargo-pgrx = pkgs.nhost.cargo-pgrx_0_19_2;

  src = pkgs.fetchFromGitHub {
    owner = "supabase";
    repo = pname;
    # The v0.3.4 tag uses pgrx 0.16.1; this post-tag commit updates it to 0.19.2.
    rev = "d08e4dea14549858b54791d6da4f606dc58a512e";
    hash = "sha256-NNMbKN+r6HZw0KjLkSBQbS9TF1FcatyUtU9i2QdXJY8=";
  };

  cargoHash = "sha256-r6+kcKVDNHLxhL3o71DKABEcVjNzBpIds9Lkk1ON2go=";
}
