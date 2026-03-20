{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_search";
  version = "0.21.1";

  cargo-pgrx = pkgs.cargo-pgrx_0_16_1;

  doCheck = false;

  cargoPgrxFlags = [
    "--package=pg_search"
  ];

  src = pkgs.fetchFromGitHub {
    owner = "paradedb";
    repo = "paradedb";
    rev = "v${version}";
    hash = "sha256-28DYHG6FB6pUOzxA6ndxctSmE9sOljW7+VZIacBRhYg=";
  };

  cargoHash = "sha256-aRQdB56DEGnpYX30obJHjkCeCEnA3hqoMlOxL57Kv5w=";
}
