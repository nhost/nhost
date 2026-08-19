{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_jsonschema";
  version = "v0.4.0-rc1";

  doCheck = false;

  cargo-pgrx = pkgs.nhost.cargo-pgrx_0_19_2;

  src = pkgs.fetchFromGitHub {
    owner = "supabase";
    repo = pname;
    rev = "d08e4dea14549858b54791d6da4f606dc58a512e";
    hash = "sha256-NNMbKN+r6HZw0KjLkSBQbS9TF1FcatyUtU9i2QdXJY8=";
  };

  cargoHash = "sha256-r6+kcKVDNHLxhL3o71DKABEcVjNzBpIds9Lkk1ON2go=";
}
