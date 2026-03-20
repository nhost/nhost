{ buildPGRXExtension, pkgs, ... }:

buildPGRXExtension rec {
  pname = "pg_search";
  version = "0.22.2";

  cargo-pgrx = pkgs.cargo-pgrx_0_17_0;

  doCheck = false;

  buildInputs = [ pkgs.icu ];
  nativeBuildInputs = [ pkgs.pkg-config ];

  cargoPgrxFlags = [
    "--package=pg_search"
  ];

  src = pkgs.fetchFromGitHub {
    owner = "paradedb";
    repo = "paradedb";
    rev = "v${version}";
    hash = "sha256-BqmYuSmA/yrfw8Np1HghOcFs7erv0SiryiGyDpV7CQQ=";
  };

  cargoHash = "sha256-kZfWYk3bx3bKV3GcDikrhg3N7gg31bi86V7dvotLtTE=";
}
